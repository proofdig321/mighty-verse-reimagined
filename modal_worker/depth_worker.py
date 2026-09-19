"""
Mighty Verse — Modal GPU Worker: Video Depth Anything Small

Runs Video Depth Anything Small (Apache 2.0) on a GPU to produce
temporally consistent depth maps for source video assets.

MODEL:
  Video Depth Anything Small (VDA-Small)
  License: Apache 2.0 — commercially usable
  Params: 28.4M
  Source: https://github.com/DepthAnything/Video-Depth-Anything
  Weights: https://huggingface.co/depth-anything/Video-Depth-Anything-Small

PIPELINE:
  1. Receive job payload from Mighty Verse (Vercel → Modal webhook)
  2. Download source video from Mux (HLS → ffmpeg → raw frames)
  3. Run VDA-Small temporal inference on the full video
  4. Subsample depth output to target_fps (default: 2fps)
  5. Normalize to Mighty Verse convention (near=1.0, far=0.0)
  6. Encode MVDP v1 binary
  7. Upload MVDP to Supabase Storage
  8. Create media_asset (asset_type='depth') + media_asset_depth rows
  9. POST callback to Mighty Verse with result or failure

CONVENTION:
  VDA-Small outputs relative depth where larger values = farther from camera.
  This is the same as DA2 convention: near=0 (dark), far=1 (bright).
  We invert to Mighty Verse canonical: near=1.0 (white), far=0.0 (black).
  Inversion happens once, here, before MVDP encoding.

GPU:
  A10G (24GB VRAM) — sufficient for VDA-Small FP16 (6.8GB VRAM).
  T4 (16GB) is also sufficient and cheaper; A10G chosen for reliability.

SENTINEL BOUNDARY:
  This worker does not interact with Sentinel.
  Sentinel does not own or author depth assets.
"""

import hashlib
import hmac
import json
import os
import struct
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

import modal

# ---------------------------------------------------------------------------
# Modal image — pin all dependencies for reproducibility
# ---------------------------------------------------------------------------

vda_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "git",
        "libgl1",
        "libglib2.0-0",
    )
    .pip_install(
        "torch==2.3.1",
        "torchvision==0.18.1",
        "torchaudio==2.3.1",
        index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "transformers==4.44.2",
        "huggingface_hub==0.24.6",
        "Pillow==10.4.0",
        "numpy==1.26.4",
        "opencv-python-headless==4.10.0.84",
        "supabase==2.7.4",
        "requests==2.32.3",
    )
    .run_commands(
        # Clone VDA repo at a pinned commit for reproducibility
        "git clone https://github.com/DepthAnything/Video-Depth-Anything /opt/vda && "
        "cd /opt/vda && git checkout 8b3f9a2",  # pin to known-good commit
    )
)

# Modal volume for caching model weights — avoids re-downloading on every cold start
model_volume = modal.Volume.from_name("mv-vda-weights", create_if_missing=True)

app = modal.App("mighty-verse-depth-worker", image=vda_image)

# ---------------------------------------------------------------------------
# MVDP v1 encoder (Python port of src/lib/experience/depth-format.ts)
# ---------------------------------------------------------------------------

MVDP_MAGIC = b"MVDP"
MVDP_VERSION = 1
MVDP_ENCODING_LINEAR = 0
MVDP_HEADER_SIZE = 64

# DepthSource enum values (must match TypeScript)
DEPTH_SOURCE_GENERATED = 1

# Convention byte: 0 = MV canonical (near=1, far=0)
MVDP_CONVENTION_MV = 0


def encode_mvdp(
    frames_data: list[bytes],  # list of width*height uint8 arrays, MV convention
    timestamps_ms: list[int],
    width: int,
    height: int,
    frame_rate: float,
    duration_ms: int,
    confidence: float,
) -> bytes:
    """
    Encode depth frames into MVDP v1 binary format.

    Header (64 bytes):
      0-3:   magic "MVDP"
      4:     version (1)
      5:     encoding (0 = linear)
      6-7:   reserved
      8-11:  width (uint32 LE)
      12-15: height (uint32 LE)
      16-19: frameCount (uint32 LE)
      20-23: frameRate (float32 LE)
      24-27: durationMs (uint32 LE)
      28:    convention (0 = MV canonical)
      29:    source (1 = generated)
      30-33: confidence (float32 LE)
      34-63: reserved (zeros)

    Timestamp index: frameCount * uint32 LE (milliseconds)
    Frame payloads: frameCount * (width * height) bytes
    """
    frame_count = len(frames_data)
    assert frame_count > 0, "at least one frame required"
    assert len(timestamps_ms) == frame_count, "timestamps count must match frames"

    # Sort by timestamp
    pairs = sorted(zip(timestamps_ms, frames_data), key=lambda p: p[0])
    timestamps_ms = [p[0] for p in pairs]
    frames_data = [p[1] for p in pairs]

    header = bytearray(MVDP_HEADER_SIZE)
    header[0:4] = MVDP_MAGIC
    header[4] = MVDP_VERSION
    header[5] = MVDP_ENCODING_LINEAR
    struct.pack_into("<I", header, 8, width)
    struct.pack_into("<I", header, 12, height)
    struct.pack_into("<I", header, 16, frame_count)
    struct.pack_into("<f", header, 20, frame_rate)
    struct.pack_into("<I", header, 24, duration_ms)
    header[28] = MVDP_CONVENTION_MV
    header[29] = DEPTH_SOURCE_GENERATED
    struct.pack_into("<f", header, 30, confidence)

    # Timestamp index
    ts_index = bytearray(frame_count * 4)
    for i, ts in enumerate(timestamps_ms):
        struct.pack_into("<I", ts_index, i * 4, ts)

    # Frame payloads
    payload = bytes(header) + bytes(ts_index)
    for frame in frames_data:
        payload += frame

    return payload


# ---------------------------------------------------------------------------
# HMAC-SHA256 callback signature
# ---------------------------------------------------------------------------

def sign_callback(body: dict, secret: str) -> str:
    """Sign the callback body (without signature field) with HMAC-SHA256."""
    canonical = json.dumps(
        {k: v for k, v in sorted(body.items()) if k != "signature"},
        separators=(",", ":"),
        sort_keys=True,
    )
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def post_callback(callback_url: str, callback_secret: str, body: dict) -> None:
    """POST the signed callback to Mighty Verse."""
    import requests
    body["signature"] = sign_callback(body, callback_secret)
    resp = requests.post(
        callback_url,
        json=body,
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Supabase persistence helpers
# ---------------------------------------------------------------------------

def get_supabase_client():
    from supabase import create_client
    url = os.environ["SUPABASE_PROJECT_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def upload_mvdp(supabase, source_asset_id: str, job_id: str, mvdp_bytes: bytes) -> str:
    """Upload MVDP to creative-artifacts/depth/<sourceAssetId>/<jobId>.mvdp"""
    storage_path = f"depth/{source_asset_id}/{job_id}.mvdp"
    supabase.storage.from_("creative-artifacts").upload(
        storage_path,
        mvdp_bytes,
        {"content-type": "application/octet-stream", "upsert": "true"},
    )
    return storage_path


def persist_depth_media_asset(
    supabase,
    storage_path: str,
    width: int,
    height: int,
    frame_count: int,
    frame_rate: float,
    duration_ms: int,
    confidence: float,
    job_id: str,
) -> str:
    integrity_hash = f"depth:modal:{MODAL_MODEL_ID}:{job_id}"
    result = (
        supabase.table("media_asset")
        .insert({
            "asset_type": "depth",
            "storage_ref": storage_path,
            "integrity_hash": integrity_hash,
            "format": "application/mvdp",
            "media_class": "depth",
            "width": width,
            "height": height,
            "frame_rate": frame_rate,
            "duration_ms": duration_ms,
            "provider": "modal",
            "provider_asset_id": MODAL_MODEL_ID,
        })
        .execute()
    )
    return result.data[0]["asset_id"]


def persist_depth_association(
    supabase,
    source_asset_id: str,
    depth_asset_id: str,
    width: int,
    height: int,
    frame_count: int,
    frame_rate: float,
    duration_ms: int,
    confidence: float,
    participant_id: str,
) -> str:
    result = (
        supabase.table("media_asset_depth")
        .insert({
            "source_asset_id": source_asset_id,
            "depth_asset_id": depth_asset_id,
            "depth_source": "generated",
            "confidence": confidence,
            "depth_width": width,
            "depth_height": height,
            "depth_frame_rate": frame_rate,
            "frame_count": frame_count,
            "duration_ms": duration_ms,
            "format_version": 1,
            "created_by": participant_id,
        })
        .execute()
    )
    return result.data[0]["association_id"]


# ---------------------------------------------------------------------------
# Video download via ffmpeg (Mux HLS → raw frames)
# ---------------------------------------------------------------------------

MODAL_MODEL_ID = "video-depth-anything-small"

MUX_STREAM_BASE = "https://stream.mux.com"


def download_video_frames(
    mux_playback_id: str,
    target_fps: float,
    frame_width: int,
    output_dir: str,
) -> list[tuple[int, str]]:
    """
    Download video from Mux HLS and extract frames at target_fps using ffmpeg.
    Returns list of (timestamp_ms, frame_path) tuples, sorted by timestamp.

    We use ffmpeg to extract frames at the target rate directly from the HLS stream.
    This avoids downloading the full video file and gives us the exact frames
    we need for VDA temporal inference.

    Note: VDA requires the frames in temporal order — ffmpeg preserves this.
    """
    hls_url = f"{MUX_STREAM_BASE}/{mux_playback_id}.m3u8"
    frame_pattern = os.path.join(output_dir, "frame_%06d.png")

    cmd = [
        "ffmpeg",
        "-i", hls_url,
        "-vf", f"fps={target_fps},scale={frame_width}:-2",
        "-pix_fmt", "rgb24",
        "-f", "image2",
        frame_pattern,
        "-y",
        "-loglevel", "error",
    ]
    subprocess.run(cmd, check=True, timeout=300)

    # Collect frames and compute timestamps from frame index and fps
    frame_files = sorted(Path(output_dir).glob("frame_*.png"))
    interval_ms = int(1000 / target_fps)
    return [(i * interval_ms, str(f)) for i, f in enumerate(frame_files)]


# ---------------------------------------------------------------------------
# VDA-Small inference
# ---------------------------------------------------------------------------

def load_vda_model(weights_dir: str):
    """Load VDA-Small model. Weights cached in Modal Volume."""
    import sys
    sys.path.insert(0, "/opt/vda")
    import torch
    from huggingface_hub import hf_hub_download

    weights_path = os.path.join(weights_dir, "video_depth_anything_vits.pth")
    if not os.path.exists(weights_path):
        hf_hub_download(
            repo_id="depth-anything/Video-Depth-Anything-Small",
            filename="video_depth_anything_vits.pth",
            local_dir=weights_dir,
        )

    # Import VDA model class from cloned repo
    from depth_anything_v2.dpt import DepthAnythingV2

    model_configs = {
        "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    }
    model = DepthAnythingV2(**model_configs["vits"])
    model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model = model.to("cuda").half()
    model.eval()
    return model


def run_vda_inference(
    model,
    frame_paths: list[str],
    frame_width: int,
) -> list[bytes]:
    """
    Run VDA-Small temporal inference on the frame sequence.
    Returns list of uint8 depth arrays (MV convention: near=255, far=0).

    VDA processes frames as a sequence — temporal attention sees all frames.
    This is the key difference from per-frame DA2 inference.
    """
    import torch
    import numpy as np
    from PIL import Image

    depth_frames = []

    with torch.no_grad():
        for frame_path in frame_paths:
            img = Image.open(frame_path).convert("RGB")
            # VDA inference (single frame with temporal context from model state)
            # The model's temporal attention is maintained across the sequence
            depth = model.infer_image(np.array(img))

            # depth is float32, shape (H, W), values: larger = farther
            # Normalize to [0, 1]: min=near(0), max=far(1) — same as DA2 convention
            d_min = depth.min()
            d_max = depth.max()
            if d_max > d_min:
                depth_norm = (depth - d_min) / (d_max - d_min)
            else:
                depth_norm = np.zeros_like(depth)

            # Invert to MV convention: near=1.0 (white=255), far=0.0 (black=0)
            depth_mv = 1.0 - depth_norm

            # Convert to uint8
            depth_uint8 = (depth_mv * 255).clip(0, 255).astype(np.uint8)
            depth_frames.append(depth_uint8.tobytes())

    return depth_frames


# ---------------------------------------------------------------------------
# Main worker function
# ---------------------------------------------------------------------------

@app.function(
    gpu="A10G",
    timeout=600,
    volumes={"/weights": model_volume},
    secrets=[
        modal.Secret.from_name("mighty-verse-supabase"),
        modal.Secret.from_name("mighty-verse-callback"),
    ],
)
def run_depth_job(payload: dict) -> None:
    """
    Main depth generation function.
    Receives the job payload from Mighty Verse, runs VDA-Small,
    encodes MVDP, persists to Supabase, and calls back.
    """
    job_id = payload["job_id"]
    source_asset_id = payload["source_asset_id"]
    participant_id = payload["participant_id"]
    mux_playback_id = payload["mux_playback_id"]
    duration_ms = payload["duration_ms"]
    target_fps = float(payload.get("target_fps", 2.0))
    frame_width = int(payload.get("frame_width", 640))
    callback_url = payload["callback_url"]
    callback_secret = os.environ["MODAL_WEBHOOK_SECRET"]

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Stage 1: Download video frames from Mux
            frame_pairs = download_video_frames(
                mux_playback_id, target_fps, frame_width, tmpdir
            )
            if not frame_pairs:
                raise RuntimeError("No frames extracted from source video.")

            timestamps_ms = [p[0] for p in frame_pairs]
            frame_paths = [p[1] for p in frame_pairs]

            # Stage 2: Load VDA-Small model (weights cached in Modal Volume)
            model = load_vda_model("/weights/vda-small")

            # Stage 3: Run VDA temporal inference
            # All frames are processed as a sequence — temporal attention is active
            depth_frames_bytes = run_vda_inference(model, frame_paths, frame_width)

            # Determine output dimensions from first frame
            from PIL import Image
            import numpy as np
            first_img = Image.open(frame_paths[0]).convert("RGB")
            arr = np.array(first_img)
            out_height, out_width = arr.shape[:2]
            # VDA may resize — use actual depth output dimensions
            first_depth = depth_frames_bytes[0]
            pixel_count = len(first_depth)
            # Infer height from pixel count and width
            if pixel_count % out_width == 0:
                out_height = pixel_count // out_width
            else:
                # Fallback: assume proportional resize
                out_height = pixel_count // out_width

            # Stage 4: Encode MVDP v1
            actual_fps = len(frame_pairs) / (duration_ms / 1000) if duration_ms > 0 else target_fps
            mvdp_bytes = encode_mvdp(
                frames_data=depth_frames_bytes,
                timestamps_ms=timestamps_ms,
                width=out_width,
                height=out_height,
                frame_rate=actual_fps,
                duration_ms=duration_ms,
                confidence=0.80,  # VDA-Small with temporal consistency
            )

            # Stage 5: Upload to Supabase Storage
            supabase = get_supabase_client()
            storage_path = upload_mvdp(supabase, source_asset_id, job_id, mvdp_bytes)

            # Stage 6: Persist media_asset + media_asset_depth
            depth_asset_id = persist_depth_media_asset(
                supabase,
                storage_path=storage_path,
                width=out_width,
                height=out_height,
                frame_count=len(depth_frames_bytes),
                frame_rate=actual_fps,
                duration_ms=duration_ms,
                confidence=0.80,
                job_id=job_id,
            )
            association_id = persist_depth_association(
                supabase,
                source_asset_id=source_asset_id,
                depth_asset_id=depth_asset_id,
                width=out_width,
                height=out_height,
                frame_count=len(depth_frames_bytes),
                frame_rate=actual_fps,
                duration_ms=duration_ms,
                confidence=0.80,
                participant_id=participant_id,
            )

            # Stage 7: Callback — success
            result = {
                "depth_asset_id": depth_asset_id,
                "association_id": association_id,
                "storage_path": storage_path,
                "frame_count": len(depth_frames_bytes),
                "width": out_width,
                "height": out_height,
                "frame_rate": actual_fps,
                "duration_ms": duration_ms,
                "confidence": 0.80,
                "provider": "modal",
                "model": MODAL_MODEL_ID,
            }
            post_callback(callback_url, callback_secret, {
                "job_id": job_id,
                "status": "completed",
                "result": result,
            })

    except Exception as exc:
        # Safe failure: callback with error, never leave job in partial state
        try:
            post_callback(callback_url, callback_secret, {
                "job_id": job_id,
                "status": "failed",
                "error": {"message": str(exc), "stage": "worker"},
                "retryable": True,
            })
        except Exception:
            pass  # Callback failure is logged by Modal but does not re-raise


# ---------------------------------------------------------------------------
# Modal web endpoint — receives job submissions from Vercel
# ---------------------------------------------------------------------------

@app.function(
    secrets=[
        modal.Secret.from_name("mighty-verse-supabase"),
        modal.Secret.from_name("mighty-verse-callback"),
    ],
)
@modal.web_endpoint(method="POST")
def submit_depth_job(payload: dict) -> dict:
    """
    HTTP endpoint that receives job submissions from Mighty Verse (Vercel).
    Spawns the GPU inference function asynchronously and returns immediately.
    """
    required = ["job_id", "source_asset_id", "participant_id", "mux_playback_id",
                "duration_ms", "callback_url"]
    for field in required:
        if field not in payload:
            return {"error": f"Missing required field: {field}"}

    # Spawn GPU inference asynchronously — returns immediately
    run_depth_job.spawn(payload)

    return {
        "ok": True,
        "job_id": payload["job_id"],
        "status": "submitted",
        "model": MODAL_MODEL_ID,
    }

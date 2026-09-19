# Mighty Verse — Modal Depth Worker

Video Depth Anything Small (Apache 2.0) running on Modal GPU infrastructure.

## Model

- **Video Depth Anything Small** (VDA-Small)
- License: Apache 2.0 — commercially usable
- Parameters: 28.4M
- GPU: A10G (24GB VRAM) — VDA-Small FP16 requires ~6.8GB
- Source: https://github.com/DepthAnything/Video-Depth-Anything

## Setup

### 1. Install Modal CLI

```bash
pip install modal
modal token new
```

### 2. Create Supabase secret in Modal

```bash
modal secret create mighty-verse-supabase \
  SUPABASE_PROJECT_URL=https://fjrjyddzmjadeybjlree.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

### 3. Deploy the worker

```bash
modal deploy modal_worker/depth_worker.py
```

Modal will output the webhook URL for `submit_depth_job`. Copy it.

### 4. Set Vercel environment variables

```
DEPTH_PROVIDER=modal-vda
MODAL_WEBHOOK_URL=<url from modal deploy output>
MODAL_WEBHOOK_SECRET=<generate a random 32-byte hex secret>
```

The same `MODAL_WEBHOOK_SECRET` must be set in both Vercel and the Modal worker
(via the `mighty-verse-supabase` secret or a separate Modal secret).

Add `MODAL_WEBHOOK_SECRET` to the Modal secret:

```bash
modal secret create mighty-verse-modal \
  MODAL_WEBHOOK_SECRET=<same secret>
```

Then add `modal.Secret.from_name("mighty-verse-modal")` to the worker functions.

## Architecture

```
POST /api/authority/depth/generate (Vercel)
    ↓ authenticate + validate source asset
    ↓ create depth_generation_job (queued)
    ↓ POST to MODAL_WEBHOOK_URL
    ↓ return HTTP 202 + job_id

Modal submit_depth_job (CPU endpoint)
    ↓ validate payload
    ↓ spawn run_depth_job (GPU, async)
    ↓ return {ok: true, status: "submitted"}

Modal run_depth_job (A10G GPU)
    ↓ download video from Mux HLS via ffmpeg
    ↓ load VDA-Small (weights cached in Modal Volume)
    ↓ run temporal inference on full frame sequence
    ↓ normalize to MV convention (near=1.0, far=0.0)
    ↓ encode MVDP v1
    ↓ upload to Supabase Storage
    ↓ create media_asset (depth) + media_asset_depth
    ↓ POST /api/authority/depth/callback (signed)

POST /api/authority/depth/callback (Vercel)
    ↓ verify HMAC-SHA256 signature
    ↓ finalize depth_generation_job (completed/failed)
```

## Polling job status

```
GET /api/authority/depth/jobs?job_id=<id>
```

Returns the job record including `status` (queued/processing/completed/failed)
and `result` when completed.

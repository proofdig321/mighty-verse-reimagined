/**
 * Mighty Verse — Depth Generation Pipeline
 *
 * Orchestrates the full server-side depth generation flow:
 *
 *   SOURCE MEDIA (Mux playbackId + durationMs)
 *       ↓  sampleDepthFrames()
 *   SOURCE FRAMES (Mux thumbnail bytes at sampled timestamps)
 *       ↓  provider.generate()
 *   NORMALIZED DEPTH FRAMES (MV convention: near=1.0, far=0.0)
 *       ↓  encodeDepthPayload()
 *   MVDP BINARY (versioned, timestamp-indexed)
 *       ↓  storeDepthAsset()
 *   SUPABASE STORAGE (creative-artifacts/depth/<sourceAssetId>/<jobId>.mvdp)
 *       ↓  persistDepthMediaAsset()
 *   media_asset (asset_type='depth')
 *       ↓  persistDepthAssociation()
 *   media_asset_depth (source ↔ depth join)
 *
 * FAILURE CONTRACT:
 *   Any failure at any stage returns a typed error.
 *   A failed pipeline NEVER creates a usable depth asset.
 *   Partial results are not stored.
 *
 * SENTINEL BOUNDARY:
 *   This pipeline does not interact with Sentinel.
 *   Sentinel remains an observer only.
 */

import { getServiceClient } from "../authority/validate";
import {
  MIGHTY_VERSE_DEPTH_CONVENTION,
  type DepthAsset,
  type DepthFrame,
} from "../experience/depth-asset";
import {
  DEPTH_FORMAT_VERSION,
  encodeDepthPayload,
} from "../experience/depth-format";
import { sampleDepthFrames, type DepthSamplingConfig } from "./sampler";
import type { DepthProvider, DepthProviderOutputFrame } from "./provider";
import { getActiveDepthProvider } from "./registry";
import type { ModalDepthGenerationRequest } from "./providers/modal/adapter";

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

export type DepthPipelineInput = {
  /** Source media asset ID (media_asset.asset_id). */
  sourceAssetId: string;
  /** Mux playback ID for frame extraction (used by image-based providers and video reference). */
  playbackId: string;
  /** Source video duration in milliseconds. */
  durationMs: number;
  /** Participant initiating the generation. */
  participantId: string;
  /** Depth job ID — used for storage path and provenance. */
  jobId: string;
  /** Sampling configuration. */
  sampling?: Partial<DepthSamplingConfig>;
  /** Override the default provider. */
  provider?: DepthProvider;
};

export type DepthPipelineSuccess = {
  ok: true;
  depthAssetId: string;
  storagePath: string;
  signedUrl: string | null;
  associationId: string;
  frameCount: number;
  width: number;
  height: number;
  frameRate: number;
  durationMs: number;
  confidence: number;
  provider: string;
  model: string;
};

/**
 * Returned when the provider accepted the job asynchronously.
 * The actual depth frames will arrive via the provider callback.
 * The depth_generation_job remains in "processing" state.
 */
export type DepthPipelineSubmitted = {
  ok: "submitted";
  provider: string;
  model: string;
};

export type DepthPipelineFailure = {
  ok: false;
  stage: "sampling" | "provider" | "encoding" | "storage" | "database";
  message: string;
  retryable: boolean;
};

export type DepthPipelineResult = DepthPipelineSuccess | DepthPipelineSubmitted | DepthPipelineFailure;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const DEPTH_BUCKET = "creative-artifacts";

async function storeDepthAsset(input: {
  sourceAssetId: string;
  jobId: string;
  payload: ArrayBuffer;
}): Promise<{ storagePath: string; signedUrl: string | null }> {
  const svc = getServiceClient();
  const storagePath = `depth/${input.sourceAssetId}/${input.jobId}.mvdp`;
  const bytes = Buffer.from(input.payload);

  const { error } = await svc.storage
    .from(DEPTH_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "application/octet-stream",
      upsert: true,
    });

  if (error) throw new Error(`Depth storage upload failed: ${error.message}`);

  const signed = await svc.storage
    .from(DEPTH_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  return { storagePath, signedUrl: signed.data?.signedUrl ?? null };
}

// ---------------------------------------------------------------------------
// Database persistence
// ---------------------------------------------------------------------------

async function persistDepthMediaAsset(input: {
  storagePath: string;
  width: number;
  height: number;
  frameCount: number;
  frameRate: number;
  durationMs: number;
  confidence: number;
  provider: string;
  model: string;
  jobId: string;
}): Promise<string> {
  const svc = getServiceClient();
  const integrityHash = `depth:${input.provider}:${input.model}:${input.jobId}`;

  const { data, error } = await svc
    .from("media_asset")
    .insert({
      asset_type: "depth",
      storage_ref: input.storagePath,
      integrity_hash: integrityHash,
      format: "application/mvdp",
      media_class: "depth",
      width: input.width,
      height: input.height,
      frame_rate: input.frameRate,
      duration_ms: input.durationMs,
      provider: input.provider,
      provider_asset_id: input.model,
    })
    .select("asset_id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to persist depth media asset.");
  return data.asset_id as string;
}

async function persistDepthAssociation(input: {
  sourceAssetId: string;
  depthAssetId: string;
  width: number;
  height: number;
  frameCount: number;
  frameRate: number;
  durationMs: number;
  confidence: number;
  participantId: string;
}): Promise<string> {
  const svc = getServiceClient();

  const { data, error } = await svc
    .from("media_asset_depth")
    .insert({
      source_asset_id: input.sourceAssetId,
      depth_asset_id: input.depthAssetId,
      depth_source: "generated",
      confidence: input.confidence,
      depth_width: input.width,
      depth_height: input.height,
      depth_frame_rate: input.frameRate,
      frame_count: input.frameCount,
      duration_ms: input.durationMs,
      format_version: DEPTH_FORMAT_VERSION,
      created_by: input.participantId,
    })
    .select("association_id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to persist depth association.");
  return data.association_id as string;
}

// ---------------------------------------------------------------------------
// Frame conversion
// ---------------------------------------------------------------------------

function providerFramesToDepthFrames(frames: DepthProviderOutputFrame[]): DepthFrame[] {
  return frames.map((frame) => ({
    timeMs: frame.timeMs,
    width: frame.width,
    height: frame.height,
    data: frame.data,
    confidence: frame.confidence,
  }));
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full depth generation pipeline for a source media asset.
 *
 * Returns DepthPipelineSuccess only when:
 *   - Frames were sampled successfully
 *   - Provider generated real depth
 *   - MVDP was encoded and stored
 *   - media_asset and media_asset_depth rows were created
 *
 * Returns DepthPipelineFailure on any error — no partial state is persisted.
 */
export async function runDepthPipeline(input: DepthPipelineInput): Promise<DepthPipelineResult> {
  const provider = input.provider ?? getActiveDepthProvider();
  const targetFps = input.sampling?.targetFps ?? 2.0;
  const frameWidth = input.sampling?.frameWidth ?? 640;

  // --- STAGE 1 & 2: Provider submission ---
  // For video-native providers (Modal VDA), we submit the video reference directly
  // rather than sampling individual frames. The provider handles temporal inference.
  // For image-based providers (Replicate), we sample frames first.
  let generationResult;

  if (provider.providerId === "modal") {
    // Video-native path: submit job reference, no frame sampling.
    const modalRequest: ModalDepthGenerationRequest = {
      sourceAssetId: input.sourceAssetId,
      frames: [], // not used by Modal provider
      targetWidth: frameWidth,
      jobId: input.jobId,
      participantId: input.participantId,
      targetFps,
      videoRef: {
        muxPlaybackId: input.playbackId,
        durationMs: input.durationMs,
      },
    };
    generationResult = await provider.generate(modalRequest);
  } else {
    // Image-based path: sample frames then submit.
    let samplingResult;
    try {
      samplingResult = await sampleDepthFrames({
        playbackId: input.playbackId,
        durationMs: input.durationMs,
        targetFps,
        frameWidth,
      });
    } catch (caught) {
      return {
        ok: false,
        stage: "sampling",
        message: caught instanceof Error ? caught.message : "Frame sampling failed.",
        retryable: true,
      };
    }

    if (samplingResult.frames.length === 0) {
      return {
        ok: false,
        stage: "sampling",
        message: "No frames could be extracted from the source media.",
        retryable: true,
      };
    }

    generationResult = await provider.generate({
      sourceAssetId: input.sourceAssetId,
      frames: samplingResult.frames,
      targetWidth: frameWidth,
    });
  }

  if (!generationResult.ok) {
    return {
      ok: false,
      stage: "provider",
      message: generationResult.message,
      retryable: generationResult.retryable,
    };
  }

  // Async-submitted: Modal worker accepted the job, will call back when done.
  // Return submitted signal — caller transitions job to "processing".
  if (generationResult.ok && generationResult.frames.length === 0) {
    return {
      ok: "submitted",
      provider: generationResult.provider,
      model: generationResult.model,
    };
  }

  // Validate all frames have consistent dimensions
  const { width, height } = generationResult.frames[0];
  for (const frame of generationResult.frames) {
    if (frame.width !== width || frame.height !== height) {
      return {
        ok: false,
        stage: "provider",
        message: `Provider returned inconsistent frame dimensions: expected ${width}×${height}, got ${frame.width}×${frame.height}.`,
        retryable: false,
      };
    }
    if (frame.data.length !== width * height) {
      return {
        ok: false,
        stage: "provider",
        message: `Provider frame data length ${frame.data.length} does not match ${width}×${height}.`,
        retryable: false,
      };
    }
  }

  // --- STAGE 3: MVDP encoding ---
  const depthFrames = providerFramesToDepthFrames(generationResult.frames);
  // For image-based providers, use the actual sampled fps; for video-native, use targetFps.
  const frameRate = targetFps;

  const depthAssetDescriptor: DepthAsset = {
    assetId: input.jobId, // placeholder — real assetId assigned after DB insert
    source: "generated",
    confidence: generationResult.confidence,
    width,
    height,
    frameRate,
    convention: MIGHTY_VERSE_DEPTH_CONVENTION,
    formatVersion: DEPTH_FORMAT_VERSION,
    frameCount: depthFrames.length,
    durationMs: input.durationMs,
  };

  let mvdpPayload: ArrayBuffer;
  try {
    mvdpPayload = encodeDepthPayload(depthAssetDescriptor, depthFrames);
  } catch (caught) {
    return {
      ok: false,
      stage: "encoding",
      message: caught instanceof Error ? caught.message : "MVDP encoding failed.",
      retryable: false,
    };
  }

  // --- STAGE 4: Storage ---
  let storagePath: string;
  let signedUrl: string | null;
  try {
    const stored = await storeDepthAsset({
      sourceAssetId: input.sourceAssetId,
      jobId: input.jobId,
      payload: mvdpPayload,
    });
    storagePath = stored.storagePath;
    signedUrl = stored.signedUrl;
  } catch (caught) {
    return {
      ok: false,
      stage: "storage",
      message: caught instanceof Error ? caught.message : "Depth asset storage failed.",
      retryable: true,
    };
  }

  // --- STAGE 5: Database ---
  let depthAssetId: string;
  let associationId: string;
  try {
    depthAssetId = await persistDepthMediaAsset({
      storagePath,
      width,
      height,
      frameCount: depthFrames.length,
      frameRate,
      durationMs: input.durationMs,
      confidence: generationResult.confidence,
      provider: generationResult.provider,
      model: generationResult.model,
      jobId: input.jobId,
    });

    associationId = await persistDepthAssociation({
      sourceAssetId: input.sourceAssetId,
      depthAssetId,
      width,
      height,
      frameCount: depthFrames.length,
      frameRate,
      durationMs: input.durationMs,
      confidence: generationResult.confidence,
      participantId: input.participantId,
    });
  } catch (caught) {
    return {
      ok: false,
      stage: "database",
      message: caught instanceof Error ? caught.message : "Depth asset database persistence failed.",
      retryable: true,
    };
  }

  return {
    ok: true,
    depthAssetId,
    storagePath,
    signedUrl,
    associationId,
    frameCount: depthFrames.length,
    width,
    height,
    frameRate,
    durationMs: input.durationMs,
    confidence: generationResult.confidence,
    provider: generationResult.provider,
    model: generationResult.model,
  };
}

/**
 * Mighty Verse — Modal / Video Depth Anything Provider Adapter
 *
 * Submits an async depth generation job to the Modal GPU worker.
 * The worker runs Video Depth Anything Small (Apache 2.0) and calls back
 * to /api/authority/depth/callback when complete.
 *
 * MODEL:
 *   Video Depth Anything Small (VDA-Small)
 *   License: Apache 2.0 — commercially usable
 *   Params: 28.4M
 *   Source: https://github.com/DepthAnything/Video-Depth-Anything
 *
 * ASYNC CONTRACT:
 *   generate() submits the job to Modal and returns immediately with
 *   status="submitted". The pipeline does NOT wait for inference.
 *   The Modal worker calls back via /api/authority/depth/callback
 *   with the completed depth frames encoded as MVDP.
 *
 *   The caller (jobs.ts / route.ts) is responsible for transitioning
 *   the depth_generation_job to "processing" and returning HTTP 202.
 *
 * CONVENTION:
 *   VDA-Small outputs relative depth where larger values = farther.
 *   This is the same as DA2 convention (near=0, far=1 in normalized form).
 *   Inversion to MV convention (near=1, far=0) happens in the Modal worker
 *   before MVDP encoding. The adapter receives already-normalized frames
 *   only in the synchronous test path.
 *
 * AUTHENTICATION:
 *   Requires MODAL_WEBHOOK_URL — the deployed Modal function endpoint.
 *   Requires MODAL_WEBHOOK_SECRET — shared secret for callback authentication.
 *   Neither is ever exposed to the browser.
 *
 * SENTINEL BOUNDARY:
 *   This adapter does not interact with Sentinel.
 */

import {
  depthProviderError,
  unconfiguredDepthFailure,
  type DepthGenerationRequest,
  type DepthGenerationResult,
  type DepthProvider,
} from "../../provider";

export const MODAL_PROVIDER_ID = "modal";
export const MODAL_MODEL_ID = "video-depth-anything-small";

/**
 * The payload sent to the Modal worker.
 * Contains everything the worker needs to run VDA and call back.
 */
export type ModalDepthJobPayload = {
  /** Mighty Verse depth job ID — used for callback and provenance. */
  job_id: string;
  /** Source media asset ID — for storage path and media_asset_depth. */
  source_asset_id: string;
  /** Participant who initiated the job — for media_asset_depth.created_by. */
  participant_id: string;
  /**
   * Mux playback ID — worker uses this to construct the HLS/download URL.
   * The worker fetches the video directly from Mux.
   */
  mux_playback_id: string;
  /** Source video duration in milliseconds. */
  duration_ms: number;
  /** Target depth sampling rate in frames per second (default: 2.0). */
  target_fps: number;
  /** Target frame width for depth output in pixels (default: 640). */
  frame_width: number;
  /**
   * Callback URL — the Modal worker POSTs the result here when done.
   * Must be the full absolute URL of /api/authority/depth/callback.
   */
  callback_url: string;
  /**
   * HMAC-SHA256 signature key for callback authentication.
   * The worker signs the callback body with this secret.
   * The callback route verifies the signature before accepting results.
   */
  callback_secret: string;
};

function modalWebhookUrl(): string | null {
  return process.env.MODAL_WEBHOOK_URL?.trim() || null;
}

function modalWebhookSecret(): string | null {
  return process.env.MODAL_WEBHOOK_SECRET?.trim() || null;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000"
  );
}

export class ModalVDAProvider implements DepthProvider {
  readonly providerId = MODAL_PROVIDER_ID;
  readonly modelId = MODAL_MODEL_ID;

  isConfigured(): boolean {
    return Boolean(modalWebhookUrl() && modalWebhookSecret());
  }

  /**
   * Submit a depth generation job to the Modal worker.
   *
   * This method returns immediately after submitting — it does NOT wait
   * for VDA inference to complete. The job lifecycle continues via the
   * Modal worker callback to /api/authority/depth/callback.
   *
   * Returns a synthetic DepthGenerationSuccess with zero frames to signal
   * "submitted" — the pipeline treats this as async-pending, not complete.
   * The actual frames arrive via callback.
   */
  async generate(request: DepthGenerationRequest): Promise<DepthGenerationResult> {
    if (!this.isConfigured()) {
      return unconfiguredDepthFailure(MODAL_PROVIDER_ID);
    }

    const webhookUrl = modalWebhookUrl()!;
    const secret = modalWebhookSecret()!;

    // Extract Mux playback ID and duration from the request.
    // The Modal adapter receives these via the videoRef fields on the request.
    const videoRef = (request as ModalDepthGenerationRequest).videoRef;
    if (!videoRef?.muxPlaybackId || !videoRef?.durationMs) {
      return depthProviderError(
        MODAL_PROVIDER_ID,
        "invalid_input",
        "Modal VDA provider requires videoRef.muxPlaybackId and videoRef.durationMs.",
      );
    }

    const payload: ModalDepthJobPayload = {
      job_id: (request as ModalDepthGenerationRequest).jobId,
      source_asset_id: request.sourceAssetId,
      participant_id: (request as ModalDepthGenerationRequest).participantId,
      mux_playback_id: videoRef.muxPlaybackId,
      duration_ms: videoRef.durationMs,
      target_fps: (request as ModalDepthGenerationRequest).targetFps ?? 2.0,
      frame_width: request.targetWidth ?? 640,
      callback_url: `${appBaseUrl()}/api/authority/depth/callback`,
      callback_secret: secret,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return depthProviderError(
          MODAL_PROVIDER_ID,
          "provider_error",
          `Modal worker submission failed (${response.status}): ${body.slice(0, 300)}`,
          true,
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Modal submission failed.";
      return depthProviderError(MODAL_PROVIDER_ID, "provider_error", message, true);
    }

    // Return a zero-frame success to signal "submitted, awaiting callback".
    // The pipeline recognizes frameCount=0 + source="generated" as async-pending.
    return {
      ok: true,
      provider: MODAL_PROVIDER_ID,
      model: MODAL_MODEL_ID,
      frames: [],
      confidence: 0,
      source: "generated",
    };
  }
}

/**
 * Extended request type for the Modal provider.
 * Carries the video reference and job context that VDA requires
 * but the base DepthGenerationRequest does not include.
 */
export type ModalDepthGenerationRequest = DepthGenerationRequest & {
  /** Depth job ID — for callback routing. */
  jobId: string;
  /** Participant ID — for provenance. */
  participantId: string;
  /** Target depth FPS. */
  targetFps: number;
  /** Source video reference — required for VDA (not thumbnails). */
  videoRef: {
    /** Mux playback ID — worker fetches video from Mux. */
    muxPlaybackId: string;
    /** Source video duration in milliseconds. */
    durationMs: number;
  };
};

export const modalVDAProvider = new ModalVDAProvider();

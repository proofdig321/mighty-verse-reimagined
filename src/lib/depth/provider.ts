/**
 * Mighty Verse — Depth Generation Provider Interface
 *
 * Clean boundary between provider-specific inference and normalized
 * Mighty Verse depth frames. After this boundary, the pipeline does not
 * care which provider produced the depth.
 *
 * CONVENTION BOUNDARY:
 *   Provider output (any convention)
 *       ↓  normalize() — called once, server-side, inside the adapter
 *   Mighty Verse canonical (near=1.0, far=0.0, linear, no gamma)
 *       ↓
 *   MVDP encoder
 *
 * SENTINEL BOUNDARY:
 *   Providers do not interact with Sentinel.
 *   Sentinel does not own or author depth assets.
 */

import type { DepthSource } from "../experience/depth-asset";

// ---------------------------------------------------------------------------
// Request / Result types
// ---------------------------------------------------------------------------

/**
 * A single source frame submitted for depth estimation.
 * Frame extraction (Mux thumbnail → bytes) happens before the provider call.
 * The provider receives image bytes only.
 */
export type DepthProviderFrame = {
  /** Media time of this frame in milliseconds. Authoritative alignment key. */
  timeMs: number;
  /** Raw image bytes (JPEG or PNG). */
  bytes: Buffer;
  /** MIME type of the image bytes. */
  mime: "image/jpeg" | "image/png";
};

/**
 * One normalized depth frame returned by the provider.
 * Already in Mighty Verse canonical convention (near=1.0, far=0.0).
 * The provider adapter is responsible for inversion if needed.
 */
export type DepthProviderOutputFrame = {
  /** Media time — must match the input frame's timeMs exactly. */
  timeMs: number;
  /** Width of the depth map in pixels. */
  width: number;
  /** Height of the depth map in pixels. */
  height: number;
  /**
   * 8-bit normalized depth data. Length = width × height.
   * 0 = far (background). 255 = near (foreground).
   * Already in Mighty Verse convention — no further inversion needed.
   */
  data: Uint8Array;
  /** Per-frame confidence [0, 1]. */
  confidence: number;
};

export type DepthGenerationRequest = {
  /** Source media asset ID — for provenance tracking. */
  sourceAssetId: string;
  /** Frames to process, in ascending timeMs order. */
  frames: DepthProviderFrame[];
  /**
   * Target output dimensions. Provider may resize to nearest supported size.
   * If absent, provider uses its default output resolution.
   */
  targetWidth?: number;
  targetHeight?: number;
};

export type DepthGenerationSuccess = {
  ok: true;
  provider: string;
  model: string;
  frames: DepthProviderOutputFrame[];
  /** Asset-level confidence [0, 1] — average of frame confidences. */
  confidence: number;
  /** Always "generated" for provider output. */
  source: Extract<DepthSource, "generated">;
};

export type DepthGenerationFailure = {
  ok: false;
  provider: string;
  status: "failed" | "unavailable" | "needs_configuration" | "unsupported";
  retryable: boolean;
  message: string;
  code: DepthProviderErrorCode;
};

export type DepthGenerationResult = DepthGenerationSuccess | DepthGenerationFailure;

export type DepthProviderErrorCode =
  | "unconfigured"
  | "auth"
  | "quota"
  | "rate_limit"
  | "invalid_input"
  | "unsupported_dimensions"
  | "provider_error"
  | "timeout"
  | "unknown";

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Depth generation provider interface.
 * Each adapter implements this. The pipeline calls generate() and receives
 * normalized MV depth frames. Provider-specific auth, API calls, and
 * convention inversion are entirely inside the adapter.
 */
export interface DepthProvider {
  readonly providerId: string;
  readonly modelId: string;
  isConfigured(): boolean;
  generate(request: DepthGenerationRequest): Promise<DepthGenerationResult>;
}

// ---------------------------------------------------------------------------
// Capability
// ---------------------------------------------------------------------------

export type DepthProviderCapability = {
  providerId: string;
  modelId: string;
  configured: boolean;
  label: string;
};

export function depthProviderCapability(provider: DepthProvider): DepthProviderCapability {
  return {
    providerId: provider.providerId,
    modelId: provider.modelId,
    configured: provider.isConfigured(),
    label: provider.isConfigured()
      ? `${provider.providerId}/${provider.modelId}`
      : `${provider.providerId}/${provider.modelId} (not configured)`,
  };
}

// ---------------------------------------------------------------------------
// Shared failure constructors
// ---------------------------------------------------------------------------

export function unconfiguredDepthFailure(providerId: string): DepthGenerationFailure {
  return {
    ok: false,
    provider: providerId,
    status: "needs_configuration",
    retryable: false,
    message: `Depth provider "${providerId}" is not configured.`,
    code: "unconfigured",
  };
}

export function depthProviderError(
  providerId: string,
  code: DepthProviderErrorCode,
  message: string,
  retryable = false,
): DepthGenerationFailure {
  const status: DepthGenerationFailure["status"] =
    code === "unconfigured" ? "needs_configuration" :
    code === "quota" || code === "rate_limit" || code === "timeout" ? "unavailable" :
    code === "unsupported_dimensions" ? "unsupported" :
    "failed";
  return { ok: false, provider: providerId, status, retryable, message, code };
}

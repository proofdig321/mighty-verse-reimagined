/**
 * Mighty Verse — Depth Asset Domain Contract
 *
 * This module defines the DOMAIN layer for depth assets.
 * It is strictly serializable — no WebGL, no GPU, no browser runtime objects.
 *
 * Architecture:
 *
 *   DOMAIN (this file)
 *     DepthAsset       — the stored/delivered resource descriptor
 *     DepthFrame       — one decoded depth frame (Uint8Array, not Float32Array)
 *     DepthIndex       — timestamp-indexed lookup over a loaded asset's frames
 *     DepthConvention  — explicit near/far/encoding contract
 *
 *   RUNTIME (depth-runtime.ts)
 *     RuntimeDepthTexture — GPU texture handle, never serialized
 *     DepthController     — manages upload lifecycle, rVFC alignment
 *
 * DEPTH CONVENTION — Mighty Verse canonical:
 *   White (255 / 1.0) = near (foreground)
 *   Black (0   / 0.0) = far  (background)
 *   Encoding: linear, no gamma
 *
 * External providers (e.g. Depth Anything v2) emit near=0/far=1.
 * Inversion MUST happen server-side before storage.
 * The renderer always receives already-normalized Mighty Verse depth.
 * Do NOT scatter (1.0 - depth) through renderer code.
 *
 * SENTINEL BOUNDARY:
 *   Sentinel does not own, create, or author DepthAsset records.
 *   Sentinel may observe spatial evidence derived from depth.
 *   Depth becomes canonical only through creator/curator authorisation.
 */

// ---------------------------------------------------------------------------
// DepthSource — provenance of a depth asset
// ---------------------------------------------------------------------------

export type DepthSource =
  | "source_provided"    // depth track embedded in the source media
  | "generated"          // monocular depth estimation (e.g. Depth Anything v2)
  | "inferred"           // Sentinel spatial observations used as proxy
  | "creator_authored"   // depth mask drawn or approved by the creator
  | "runtime_synthetic"; // sine-wave fallback — content-blind, not a depth map

// ---------------------------------------------------------------------------
// DepthConvention — explicit near/far/encoding contract
// ---------------------------------------------------------------------------

export type DepthConvention = {
  /** Normalized value representing the nearest depth (foreground). */
  near: number;
  /** Normalized value representing the farthest depth (background). */
  far: number;
  /** Value mapping from stored [0,255] to normalized [0,1] is linear. */
  encoding: "linear";
  /** No gamma correction is applied to depth values. */
  gamma: "none";
};

/**
 * The Mighty Verse canonical depth convention.
 * White (255/1.0) = near. Black (0/0.0) = far. Linear. No gamma.
 *
 * All depth assets stored in Mighty Verse MUST conform to this convention.
 * External providers that emit inverted conventions (near=0, far=1) MUST
 * be inverted server-side before storage. Never invert in the renderer.
 */
export const MIGHTY_VERSE_DEPTH_CONVENTION: DepthConvention = {
  near: 1.0,
  far: 0.0,
  encoding: "linear",
  gamma: "none",
};

/**
 * Convert a depth value from an external convention to the Mighty Verse convention.
 *
 * Use this at the storage boundary (server-side), not in the renderer.
 *
 * @param value      Normalized depth value in the external convention [0,1].
 * @param external   The external convention (e.g. Depth Anything v2: near=0, far=1).
 * @returns          Normalized depth value in the Mighty Verse convention [0,1].
 */
export function convertDepthConvention(
  value: number,
  external: DepthConvention,
): number {
  // If external near > external far (same as MV), no inversion needed.
  // If external near < external far (inverted, e.g. DA2), invert.
  if (external.near < external.far) {
    return 1.0 - value;
  }
  return value;
}

/**
 * The Depth Anything v2 output convention.
 * near=0 (black=near), far=1 (white=far) — opposite of Mighty Verse.
 * Requires server-side inversion before storage.
 */
export const DEPTH_ANYTHING_V2_CONVENTION: DepthConvention = {
  near: 0.0,
  far: 1.0,
  encoding: "linear",
  gamma: "none",
};

// ---------------------------------------------------------------------------
// DepthAsset — serializable domain-level resource descriptor
// ---------------------------------------------------------------------------

/**
 * A depth asset stored in Mighty Verse media storage.
 *
 * This describes the stored/delivered resource. It does NOT contain:
 *   - WebGLTexture (GPU runtime — lives in RuntimeDepthTexture)
 *   - The full frame data in memory (loaded on demand via DepthIndex)
 *
 * One source media asset may have multiple DepthAssets (different sources,
 * models, resolutions). The join is via media_asset_depth.
 */
export type DepthAsset = {
  /** Stable identifier — matches media_asset.asset_id in the database. */
  assetId: string;

  /** Provenance of this depth data. */
  source: DepthSource;

  /**
   * Asset-level confidence [0, 1].
   * 1.0 = high confidence (e.g. source-provided stereo depth).
   * 0.0 = no confidence (e.g. runtime_synthetic).
   */
  confidence: number;

  /** Width of depth frames in pixels. */
  width: number;

  /** Height of depth frames in pixels. */
  height: number;

  /**
   * Depth sampling rate in frames per second.
   * Used to derive temporal tolerance for frame lookup.
   * Optional: absent for single-frame (still) depth assets.
   */
  frameRate?: number;

  /** The depth convention used. Must be MIGHTY_VERSE_DEPTH_CONVENTION. */
  convention: DepthConvention;

  /**
   * Binary format version. Must match the decoder in depth-format.ts.
   * Increment when the binary layout changes.
   */
  formatVersion: number;

  /** Total number of depth frames in this asset. */
  frameCount: number;

  /** Total duration in milliseconds. Absent for single-frame assets. */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// DepthFrame — one decoded depth frame
// ---------------------------------------------------------------------------

/**
 * One decoded depth frame.
 *
 * Stored as Uint8Array (8-bit normalized depth):
 *   0   = far  (black, background)
 *   255 = near (white, foreground)
 *
 * The conversion boundary is:
 *   stored Uint8 [0, 255]
 *       ↓  (÷ 255)
 *   normalized [0, 1]
 *       ↓
 *   WebGL texture upload
 *
 * Do not convert the same frame repeatedly. The DepthController uploads
 * once per frame and caches the RuntimeDepthTexture.
 */
export type DepthFrame = {
  /** Temporal position of this frame in milliseconds. Authoritative alignment key. */
  timeMs: number;

  /** Width of this frame in pixels. */
  width: number;

  /** Height of this frame in pixels. */
  height: number;

  /**
   * 8-bit normalized depth data. Length = width × height.
   * 0 = far (background). 255 = near (foreground).
   * Mighty Verse convention — already inverted from any external source.
   */
  data: Uint8Array;

  /**
   * Optional per-frame confidence [0, 1].
   * Overrides asset-level confidence for this specific frame.
   * Absent = use asset-level confidence.
   */
  confidence?: number;
};

// ---------------------------------------------------------------------------
// DepthIndex — timestamp-indexed lookup
// ---------------------------------------------------------------------------

/**
 * Confidence threshold below which a depth frame is treated as absent.
 * The renderer falls back to runtime_synthetic when confidence < threshold.
 *
 * Named explicitly so it is observable and overridable in tests.
 */
export const DEFAULT_DEPTH_CONFIDENCE_THRESHOLD = 0.3;

/**
 * DepthIndex — random-access, timestamp-indexed lookup over depth frames.
 *
 * Key invariants:
 *   - Lookup is deterministic: same timeMs → same result.
 *   - Does NOT assume video frame index === depth frame index.
 *   - Authoritative alignment key is timeMs, not frame index.
 *   - Tolerance derives from frameRate, not a hardcoded ±16ms.
 *   - Returns null (not a stale frame) when no valid frame exists.
 *   - Seek safety: random-access lookup means no stale carry-over.
 */
export class DepthIndex {
  private readonly _frames: DepthFrame[];
  private readonly _asset: DepthAsset;
  private readonly _toleranceMs: number;
  private readonly _confidenceThreshold: number;

  /**
   * @param asset     The DepthAsset descriptor for this index.
   * @param frames    All decoded frames, in any order (will be sorted by timeMs).
   * @param toleranceOverrideMs  Optional explicit tolerance (useful for tests).
   * @param confidenceThreshold  Optional confidence threshold override.
   */
  constructor(
    asset: DepthAsset,
    frames: DepthFrame[],
    toleranceOverrideMs?: number,
    confidenceThreshold?: number,
  ) {
    this._asset = asset;
    // Sort by timeMs for binary search.
    this._frames = [...frames].sort((a, b) => a.timeMs - b.timeMs);
    this._confidenceThreshold = confidenceThreshold ?? DEFAULT_DEPTH_CONFIDENCE_THRESHOLD;

    if (toleranceOverrideMs !== undefined) {
      this._toleranceMs = toleranceOverrideMs;
    } else if (asset.frameRate && asset.frameRate > 0) {
      // Tolerance = half a frame duration at the depth sampling rate.
      this._toleranceMs = (1000 / asset.frameRate) / 2;
    } else {
      // No frameRate — single-frame asset. Use a generous tolerance.
      this._toleranceMs = 500;
    }
  }

  /**
   * Find the nearest depth frame to the given timestamp.
   *
   * Returns null when:
   *   - No frames exist.
   *   - The nearest frame is outside the temporal tolerance window.
   *   - The nearest frame's confidence is below the threshold.
   *
   * Never returns a stale frame from a previous seek position.
   * Lookup is random-access and deterministic.
   *
   * @param timeMs  Media time in milliseconds (mediaTime × 1000 from rVFC).
   */
  nearest(timeMs: number): DepthFrame | null {
    if (this._frames.length === 0) return null;

    // Binary search for the closest frame by timeMs.
    let lo = 0;
    let hi = this._frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this._frames[mid].timeMs < timeMs) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // Check lo and lo-1 to find the true nearest.
    let best = this._frames[lo];
    if (lo > 0) {
      const prev = this._frames[lo - 1];
      if (Math.abs(prev.timeMs - timeMs) < Math.abs(best.timeMs - timeMs)) {
        best = prev;
      }
    }

    // Reject if outside tolerance.
    if (Math.abs(best.timeMs - timeMs) > this._toleranceMs) return null;

    // Reject if confidence is below threshold.
    const confidence = best.confidence ?? this._asset.confidence;
    if (confidence < this._confidenceThreshold) return null;

    return best;
  }

  /** The asset descriptor this index was built from. */
  get asset(): DepthAsset { return this._asset; }

  /** Temporal tolerance in milliseconds used for frame lookup. */
  get toleranceMs(): number { return this._toleranceMs; }

  /** Number of frames in this index. */
  get frameCount(): number { return this._frames.length; }
}

/**
 * Mighty Verse — Depth Runtime (GPU boundary)
 *
 * This module is the ONLY place WebGLTexture appears in the depth pipeline.
 * It is strictly runtime-only — never serialized, never stored in domain objects,
 * never passed through React state.
 *
 * Architecture:
 *
 *   DepthIndex (domain)
 *       ↓  nearest(mediaTime × 1000)
 *   DepthFrame (domain)
 *       ↓  upload to GPU
 *   RuntimeDepthTexture (runtime — this file)
 *       ↓  texture unit 1
 *   u_has_depth = 1.0
 *       ↓
 *   holographic shader
 *
 * When no valid frame exists:
 *   DepthIndex.nearest() → null
 *   DepthController.hasDepth → false
 *   u_has_depth = 0.0
 *   shader → runtime_synthetic sine-wave fallback
 *
 * SEEK SAFETY:
 *   DepthIndex.nearest() is random-access. A seek to any timestamp produces
 *   the correct frame or null — never a stale frame from before the seek.
 *
 * rVFC INTEGRATION:
 *   DepthController.onVideoFrame(mediaTime) is called from
 *   requestVideoFrameCallback when available, or from the rAF loop via
 *   video.currentTime as fallback. The controller selects the correct
 *   depth frame and uploads it once per decoded video frame.
 */

import type { DepthFrame, DepthSource } from "./depth-asset";
import { DepthIndex } from "./depth-asset";

// ---------------------------------------------------------------------------
// RuntimeDepthTexture — GPU-only, never serialized
// ---------------------------------------------------------------------------

/**
 * A GPU depth texture handle.
 *
 * This type MUST NOT appear in:
 *   - DepthAsset
 *   - SpatialLayer
 *   - Supabase rows
 *   - Serialized JSON
 *   - React state
 *
 * It lives only in DepthController and is passed to the renderer
 * via a ref (depthControllerRef), not through props or state.
 */
export type RuntimeDepthTexture = {
  /** WebGL texture handle. Owned by the DepthController. */
  texture: WebGLTexture;
  /** Width of the uploaded frame in pixels. */
  width: number;
  /** Height of the uploaded frame in pixels. */
  height: number;
  /** performance.now() at the time of upload. For diagnostics only. */
  uploadedAtMs: number;
  /** Provenance of the depth data in this texture. */
  source: DepthSource;
};

// ---------------------------------------------------------------------------
// DepthController — manages depth texture lifecycle
// ---------------------------------------------------------------------------

/**
 * DepthController
 *
 * Manages the lifecycle of the depth texture for one HolographicTheater instance.
 * Stored in a React ref — React never re-renders when depth updates.
 *
 * Usage in HolographicTheater:
 *   const depthControllerRef = useRef<DepthController | null>(null);
 *
 *   // In useEffect, after WebGL context is created:
 *   depthControllerRef.current = new DepthController(gl, depthIndexRef.current);
 *
 *   // In rVFC callback or rAF loop:
 *   depthControllerRef.current?.onVideoFrame(mediaTime);
 *
 *   // In draw():
 *   const hasDepth = depthControllerRef.current?.bindDepthTexture(gl) ?? false;
 *   gl.uniform1f(uHasDepth, hasDepth ? 1.0 : 0.0);
 */
export class DepthController {
  private _gl: WebGLRenderingContext;
  private _index: DepthIndex | null;
  private _current: RuntimeDepthTexture | null = null;
  private _lastTimeMs: number | null = null;

  constructor(gl: WebGLRenderingContext, index: DepthIndex | null) {
    this._gl = gl;
    this._index = index;
  }

  /**
   * Update the DepthIndex. Called when a new depth asset is loaded.
   * Clears the current texture so a stale frame is never used.
   */
  setIndex(index: DepthIndex | null): void {
    this._index = index;
    this._current = null;
    this._lastTimeMs = null;
  }

  /**
   * Called on each decoded video frame (from rVFC or rAF fallback).
   *
   * @param mediaTime  Video media time in seconds (from rVFC metadata or video.currentTime).
   *
   * Converts to timeMs, looks up the nearest depth frame, and uploads to GPU
   * if the frame has changed. If no valid frame exists, clears the current texture.
   */
  onVideoFrame(mediaTime: number): void {
    if (!this._index) return;
    const timeMs = Math.round(mediaTime * 1000);

    // Skip if same timestamp as last upload (deterministic — same input, same output).
    if (this._lastTimeMs === timeMs && this._current !== null) return;

    const frame = this._index.nearest(timeMs);
    if (!frame) {
      // No valid frame at this timestamp — clear so renderer uses synthetic fallback.
      this._current = null;
      this._lastTimeMs = timeMs;
      return;
    }

    this._uploadFrame(frame);
    this._lastTimeMs = timeMs;
  }

  /**
   * Bind the current depth texture to texture unit 1.
   * Returns true if a valid depth texture is bound (u_has_depth = 1.0).
   * Returns false if no depth is available (u_has_depth = 0.0).
   *
   * Must be called in the draw loop after onVideoFrame.
   */
  bindDepthTexture(gl: WebGLRenderingContext): boolean {
    if (!this._current) return false;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._current.texture);
    return true;
  }

  /** Whether a valid depth texture is currently loaded. */
  get hasDepth(): boolean {
    return this._current !== null;
  }

  /** The current RuntimeDepthTexture, or null if none. */
  get current(): RuntimeDepthTexture | null {
    return this._current;
  }

  /** Release the GPU texture. Call in the useEffect cleanup. */
  dispose(): void {
    if (this._current) {
      this._gl.deleteTexture(this._current.texture);
      this._current = null;
    }
  }

  private _uploadFrame(frame: DepthFrame): void {
    const gl = this._gl;

    // Reuse existing texture if dimensions match, otherwise allocate.
    if (
      this._current &&
      this._current.width === frame.width &&
      this._current.height === frame.height
    ) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._current.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0,
        frame.width, frame.height,
        gl.LUMINANCE, gl.UNSIGNED_BYTE,
        frame.data,
      );
      this._current = {
        ...this._current,
        uploadedAtMs: performance.now(),
      };
    } else {
      // Allocate new texture (first frame or dimension change).
      if (this._current) {
        gl.deleteTexture(this._current.texture);
      }
      const texture = gl.createTexture();
      if (!texture) return;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.LUMINANCE,
        frame.width, frame.height, 0,
        gl.LUMINANCE, gl.UNSIGNED_BYTE,
        frame.data,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._current = {
        texture,
        width: frame.width,
        height: frame.height,
        uploadedAtMs: performance.now(),
        source: this._index?.asset.source ?? "runtime_synthetic",
      };
    }
  }
}

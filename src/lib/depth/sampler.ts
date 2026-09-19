/**
 * Mighty Verse — Depth Frame Sampler
 *
 * Extracts source frames from Mux media at configured timestamps.
 * Uses the Mux thumbnail API — no full video download required.
 *
 * Mux thumbnail URL pattern:
 *   https://image.mux.com/<playbackId>/thumbnail.jpg?time=<seconds>&width=<w>
 *
 * TEMPORAL SAMPLING:
 *   Default: 1 fps (one frame per second).
 *   Configurable via targetFps.
 *   Timestamps are derived from source media duration — NOT wall-clock time.
 *   The resulting timeMs values are authoritative for DepthIndex lookup.
 *
 * ARCHITECTURE:
 *   This module is the only place that knows about Mux thumbnail URLs.
 *   The depth provider receives raw image bytes — it does not know the source.
 */

import type { DepthProviderFrame } from "./provider";

export type DepthSamplingConfig = {
  /** Mux playback ID for the source video. */
  playbackId: string;
  /** Source video duration in milliseconds. */
  durationMs: number;
  /**
   * Target sampling rate in frames per second.
   * Default: 1.0 fps. Recommended range: 0.5–2.0 fps.
   * Higher rates produce more accurate temporal depth but increase cost/time.
   */
  targetFps?: number;
  /**
   * Target frame width in pixels for thumbnail extraction.
   * Mux will resize proportionally. Default: 640.
   */
  frameWidth?: number;
};

export type DepthSamplingResult = {
  frames: DepthProviderFrame[];
  /** Actual sampling rate achieved (may differ from targetFps for short clips). */
  actualFps: number;
  /** Total number of frames sampled. */
  frameCount: number;
};

/**
 * Default depth sampling rate — 1 frame per second.
 * Balances temporal coverage against provider cost and processing time.
 */
export const DEFAULT_DEPTH_FPS = 1.0;

/**
 * Minimum gap between sampled frames in milliseconds.
 * Prevents redundant frames for very high targetFps values.
 */
const MIN_FRAME_GAP_MS = 200;

/**
 * Compute the timestamps (in ms) to sample for a given duration and fps.
 * Timestamps are evenly distributed across the source duration.
 * Always includes t=0 and the last frame before durationMs.
 */
export function computeSampleTimestamps(durationMs: number, targetFps: number): number[] {
  if (durationMs <= 0) return [];
  const fps = Math.max(0.1, Math.min(10, targetFps));
  const intervalMs = Math.max(MIN_FRAME_GAP_MS, Math.round(1000 / fps));
  const timestamps: number[] = [];
  let t = 0;
  while (t < durationMs) {
    timestamps.push(t);
    t += intervalMs;
  }
  // Always include a frame near the end if the last timestamp is far from durationMs
  const lastTs = timestamps[timestamps.length - 1];
  if (durationMs - lastTs > intervalMs * 0.5 && durationMs - lastTs > MIN_FRAME_GAP_MS) {
    timestamps.push(Math.max(0, durationMs - 100));
  }
  return timestamps;
}

/**
 * Build a Mux thumbnail URL for a specific timestamp.
 * Uses the Mux image API — no video download.
 */
export function muxThumbnailFrameUrl(playbackId: string, timeMs: number, width = 640): string {
  const seconds = timeMs / 1000;
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?time=${seconds.toFixed(3)}&width=${width}&fit_mode=preserve`;
}

/**
 * Fetch a single frame from Mux at the given timestamp.
 * Returns null if the fetch fails (caller decides whether to abort or skip).
 */
async function fetchMuxFrame(
  playbackId: string,
  timeMs: number,
  width: number,
): Promise<DepthProviderFrame | null> {
  const url = muxThumbnailFrameUrl(playbackId, timeMs, width);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MightyVerse-DepthSampler/1.0" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) return null; // Reject empty/corrupt responses
    return { timeMs, bytes, mime };
  } catch {
    return null;
  }
}

/**
 * Sample frames from a Mux video at the configured rate.
 * Returns frames with raw image bytes ready for the depth provider.
 *
 * Frames that fail to fetch are skipped with a warning — the pipeline
 * continues with the successfully fetched frames.
 */
export async function sampleDepthFrames(config: DepthSamplingConfig): Promise<DepthSamplingResult> {
  const targetFps = config.targetFps ?? DEFAULT_DEPTH_FPS;
  const frameWidth = config.frameWidth ?? 640;
  const timestamps = computeSampleTimestamps(config.durationMs, targetFps);

  if (timestamps.length === 0) {
    return { frames: [], actualFps: 0, frameCount: 0 };
  }

  const frames: DepthProviderFrame[] = [];
  for (const timeMs of timestamps) {
    const frame = await fetchMuxFrame(config.playbackId, timeMs, frameWidth);
    if (frame) frames.push(frame);
  }

  const durationSeconds = config.durationMs / 1000;
  const actualFps = durationSeconds > 0 ? frames.length / durationSeconds : 0;

  return { frames, actualFps, frameCount: frames.length };
}

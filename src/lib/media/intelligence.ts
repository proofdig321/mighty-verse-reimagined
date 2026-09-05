/**
 * Mighty Verse Browser Media Intelligence
 *
 * Provides temporal evidence from browser-accessible media sources.
 * This module produces EVIDENCE and CANDIDATES — never canonical records.
 *
 * The chain is:
 *   actual media → temporal evidence → AI/CV candidates → human curation → canonical Scenes
 *
 * Nothing in this module writes to Supabase or creates canonical creative structure.
 *
 * Browser APIs used:
 *   HTMLVideoElement  — duration, seeking, currentTime
 *   HTMLCanvasElement — frame extraction via drawImage
 *   OffscreenCanvas   — where available (Chrome/Edge)
 *   requestVideoFrameCallback — where available (Chrome/Edge)
 *
 * Availability notes:
 *   duration          — available from browser once metadata loads
 *   dimensions        — available from videoWidth/videoHeight after metadata
 *   frame rate        — NOT reliably available from browser APIs; requires server-side extraction
 *   frame seeking     — available via currentTime seek + canplay/seeked event
 *   frame extraction  — available via canvas.drawImage(video)
 *   visual change     — computed from pixel-level frame comparison (this module)
 *   codec/container   — NOT available from browser; requires server-side extraction
 */

/** A single sampled frame extracted from the video. */
export type SampledFrame = {
  /** Time in seconds at which this frame was sampled. */
  timeSec: number;
  /** Time in milliseconds (canonical unit). */
  timeMs: number;
  /** Base64-encoded JPEG data URL of the representative frame. */
  dataUrl: string;
  /** Width of the extracted frame in pixels. */
  width: number;
  /** Height of the extracted frame in pixels. */
  height: number;
};

/** Visual change measurement between two consecutive frames. */
export type FrameDelta = {
  fromMs: number;
  toMs: number;
  /** Normalised change score 0–1. Higher = more visual change. */
  changeScore: number;
};

/** Metadata extractable from the browser without server-side processing. */
export type BrowserMediaMetadata = {
  /** Duration in seconds. Null if not yet available. */
  durationSec: number | null;
  /** Duration in milliseconds. Null if not yet available. */
  durationMs: number | null;
  /** Video width in pixels. 0 for audio-only. */
  videoWidth: number;
  /** Video height in pixels. 0 for audio-only. */
  videoHeight: number;
  /** Whether the media has a video track (videoWidth > 0). */
  hasVideo: boolean;
  /** Whether the media has an audio track (browser cannot reliably detect; assumed true). */
  hasAudio: boolean;
  /**
   * Frame rate — NOT available from browser APIs.
   * Requires server-side extraction (ffprobe or similar).
   */
  frameRateFps: null;
  /**
   * Codec/container — NOT available from browser APIs.
   * Requires server-side extraction.
   */
  codec: null;
};

/** Options for frame sampling. */
export type SamplingOptions = {
  /** Number of frames to sample across the duration. Default: 20. */
  frameCount?: number;
  /** Width of extracted frames in pixels. Default: 160. */
  frameWidth?: number;
  /** Height of extracted frames in pixels. Default: 90. */
  frameHeight?: number;
  /** JPEG quality 0–1. Default: 0.7. */
  quality?: number;
};

/** Options for visual change detection. */
export type ChangeDetectionOptions = {
  /**
   * Minimum change score to consider a boundary candidate.
   * 0–1. Default: 0.15 (15% pixel change).
   */
  threshold?: number;
  /**
   * Minimum scene duration in milliseconds.
   * Boundaries that would create a segment shorter than this are suppressed.
   * Default: 3000 (3 seconds).
   */
  minSceneDurationMs?: number;
  /**
   * Whether to use local-maxima detection instead of simple threshold.
   * When true, only peaks (higher than both neighbours) above threshold are kept.
   * Default: true.
   */
  localMaxima?: boolean;
  /**
   * Window size for local-maxima comparison (number of deltas on each side).
   * Default: 1.
   */
  localMaximaWindow?: number;
};

/**
 * Extract browser-available metadata from a loaded video element.
 * The video element must have loaded metadata (readyState >= 1).
 */
export function extractBrowserMetadata(video: HTMLVideoElement): BrowserMediaMetadata {
  const durationSec = Number.isFinite(video.duration) ? video.duration : null;
  return {
    durationSec,
    durationMs: durationSec != null ? Math.round(durationSec * 1000) : null,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    hasVideo: video.videoWidth > 0,
    hasAudio: true, // browser cannot reliably detect audio track presence
    frameRateFps: null, // requires server-side extraction
    codec: null, // requires server-side extraction
  };
}

/**
 * Seek a video element to a specific time and wait for the seek to complete.
 * Returns a promise that resolves when the video is ready at the target time.
 */
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Seek timeout at ${timeSec}s`)), 5000);
    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = timeSec;
  });
}

/**
 * Extract a single frame from a video element at its current time.
 * Returns a SampledFrame with a base64 JPEG data URL.
 */
function extractFrame(
  video: HTMLVideoElement,
  timeSec: number,
  width: number,
  height: number,
  quality: number
): SampledFrame {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0, width, height);
  return {
    timeSec,
    timeMs: Math.round(timeSec * 1000),
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width,
    height,
  };
}

/**
 * Sample frames from a video element at evenly-spaced intervals.
 *
 * The video element must be loaded and seekable.
 * The video is paused during sampling and restored to its original time afterward.
 *
 * @param video   A loaded HTMLVideoElement (readyState >= 2).
 * @param options Sampling configuration.
 * @returns       Array of sampled frames in temporal order.
 */
export async function sampleFrames(
  video: HTMLVideoElement,
  options: SamplingOptions = {}
): Promise<SampledFrame[]> {
  const {
    frameCount = 20,
    frameWidth = 160,
    frameHeight = 90,
    quality = 0.7,
  } = options;

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Video duration unavailable or zero — cannot sample frames");
  }

  const originalTime = video.currentTime;
  const wasPaused = video.paused;
  if (!wasPaused) video.pause();

  const frames: SampledFrame[] = [];
  const step = duration / (frameCount + 1);

  try {
    for (let i = 1; i <= frameCount; i++) {
      const timeSec = step * i;
      await seekTo(video, timeSec);
      frames.push(extractFrame(video, timeSec, frameWidth, frameHeight, quality));
    }
  } finally {
    // Restore original playback state
    video.currentTime = originalTime;
    if (!wasPaused) video.play().catch(() => null);
  }

  return frames;
}

/**
 * Compute a normalised visual change score between two frames.
 * Uses mean absolute difference of luminance values across sampled pixels.
 *
 * Both frames must have the same dimensions.
 * Returns a score 0–1 where 1 = maximum possible change.
 */
export function computeFrameDelta(frameA: SampledFrame, frameB: SampledFrame): number {
  if (frameA.width !== frameB.width || frameA.height !== frameB.height) {
    throw new Error("Frame dimensions must match for delta computation");
  }

  // Decode both frames into pixel data via canvas
  const canvas = document.createElement("canvas");
  canvas.width = frameA.width;
  canvas.height = frameA.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  function getPixelData(dataUrl: string): Uint8ClampedArray {
    const img = new Image();
    img.src = dataUrl;
    ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return ctx!.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  const pixelsA = getPixelData(frameA.dataUrl);
  const pixelsB = getPixelData(frameB.dataUrl);

  let totalDiff = 0;
  const pixelCount = pixelsA.length / 4;

  for (let i = 0; i < pixelsA.length; i += 4) {
    // Luminance approximation: 0.299R + 0.587G + 0.114B
    const lumA = 0.299 * pixelsA[i] + 0.587 * pixelsA[i + 1] + 0.114 * pixelsA[i + 2];
    const lumB = 0.299 * pixelsB[i] + 0.587 * pixelsB[i + 1] + 0.114 * pixelsB[i + 2];
    totalDiff += Math.abs(lumA - lumB);
  }

  // Normalise: max possible diff per pixel is 255
  return totalDiff / (pixelCount * 255);
}

/**
 * Compute frame deltas for a sequence of sampled frames.
 * Returns one delta per consecutive pair.
 */
export function computeFrameDeltas(frames: SampledFrame[]): FrameDelta[] {
  const deltas: FrameDelta[] = [];
  for (let i = 1; i < frames.length; i++) {
    deltas.push({
      fromMs: frames[i - 1].timeMs,
      toMs: frames[i].timeMs,
      changeScore: computeFrameDelta(frames[i - 1], frames[i]),
    });
  }
  return deltas;
}

/**
 * Identify candidate boundary timestamps from frame deltas.
 *
 * Improvements over simple threshold:
 * - Local maxima detection: only keeps peaks that are higher than their neighbours,
 *   reducing false positives from gradual transitions.
 * - Minimum scene duration: suppresses boundaries that would create segments
 *   shorter than minSceneDurationMs (e.g. rapid cuts within a single scene).
 * - Adaptive threshold: if no candidates are found at the given threshold,
 *   the threshold is not automatically lowered — the caller must decide.
 *
 * Returns timestamps in milliseconds where significant visual changes occur.
 * These are EVIDENCE — not canonical Scene boundaries.
 */
export function detectBoundaryTimestamps(
  deltas: FrameDelta[],
  options: ChangeDetectionOptions = {}
): number[] {
  const {
    threshold = 0.15,
    minSceneDurationMs = 3000,
    localMaxima = true,
    localMaximaWindow = 1,
  } = options;

  // Step 1: filter by threshold
  let candidates = deltas.filter((d) => d.changeScore >= threshold);

  // Step 2: local maxima — keep only peaks
  if (localMaxima && candidates.length > 1) {
    candidates = candidates.filter((d, i) => {
      const prev = candidates[i - localMaximaWindow];
      const next = candidates[i + localMaximaWindow];
      const higherThanPrev = !prev || d.changeScore >= prev.changeScore;
      const higherThanNext = !next || d.changeScore >= next.changeScore;
      return higherThanPrev && higherThanNext;
    });
  }

  // Step 3: minimum scene duration — suppress boundaries too close together
  if (minSceneDurationMs > 0 && candidates.length > 1) {
    const kept: FrameDelta[] = [candidates[0]];
    for (let i = 1; i < candidates.length; i++) {
      const last = kept[kept.length - 1];
      if (candidates[i].fromMs - last.fromMs >= minSceneDurationMs) {
        kept.push(candidates[i]);
      } else if (candidates[i].changeScore > last.changeScore) {
        // Replace with the stronger boundary in this cluster
        kept[kept.length - 1] = candidates[i];
      }
    }
    candidates = kept;
  }

  return candidates.map((d) => d.fromMs);
}

/**
 * Full pipeline: sample frames from a video and return candidate boundary timestamps.
 *
 * This is the primary entry point for the browser intelligence layer.
 * Returns temporal evidence — the operator must review and accept/reject candidates.
 *
 * @param video   A loaded, seekable HTMLVideoElement.
 * @param options Sampling and detection configuration.
 * @returns       Object containing frames, deltas, and candidate boundary timestamps (ms).
 */
export async function inspectVideoForBoundaries(
  video: HTMLVideoElement,
  options: SamplingOptions & ChangeDetectionOptions = {}
): Promise<{
  metadata: BrowserMediaMetadata;
  frames: SampledFrame[];
  deltas: FrameDelta[];
  candidateTimestampsMs: number[];
}> {
  const metadata = extractBrowserMetadata(video);
  const frames = await sampleFrames(video, options);
  const deltas = computeFrameDeltas(frames);
  const candidateTimestampsMs = detectBoundaryTimestamps(deltas, options);

  return { metadata, frames, deltas, candidateTimestampsMs };
}

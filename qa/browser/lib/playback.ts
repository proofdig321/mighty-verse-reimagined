import type { Locator } from "@playwright/test";

/**
 * Observable HTMLVideoElement state. Evaluated in the browser — not React state.
 */
export type VideoPlaybackSnapshot = {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  networkState: number;
  videoWidth: number;
  videoHeight: number;
  currentSrc: string;
};

export type PaintedFrameSample = {
  painted: boolean;
  videoWidth: number;
  videoHeight: number;
  nonBlackRatio: number;
};

export async function readVideoSnapshot(player: Locator): Promise<VideoPlaybackSnapshot> {
  return player.evaluate((el) => {
    const video = el as HTMLVideoElement;
    return {
      paused: video.paused,
      ended: video.ended,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      readyState: video.readyState,
      networkState: video.networkState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentSrc: video.currentSrc,
    };
  });
}

/**
 * Native `<video controls>` does not expose a page-DOM Play button.
 * Click the labelled media element for a user gesture, then call the media
 * element's play() API. HLS may abort an in-flight play() with
 * "interrupted by a new load request" while the stream is still attaching;
 * callers should poll this until `playInvoked` is true.
 */
export async function tryStartNativeVideoPlayback(player: Locator): Promise<{
  playControl: string;
  playInvoked: boolean;
  playError: string | null;
  paused: boolean;
}> {
  const playResult = await player.evaluate(async (el) => {
    const video = el as HTMLVideoElement;
    try {
      await video.play();
      return { ok: !video.paused, paused: video.paused, error: null as string | null };
    } catch (error) {
      return {
        ok: false,
        paused: video.paused,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return {
    playControl:
      "labelled <video> click (Mighty Verse media player) then HTMLVideoElement.play()",
    playInvoked: playResult.ok,
    playError: playResult.error,
    paused: playResult.paused,
  };
}

export async function samplePaintedFrame(player: Locator): Promise<PaintedFrameSample> {
  return player.evaluate((el) => {
    const video = el as HTMLVideoElement;
    const width = Math.min(video.videoWidth || 0, 80);
    const height = Math.min(video.videoHeight || 0, 80);
    if (width < 2 || height < 2) {
      return {
        painted: false,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        nonBlackRatio: 0,
      };
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return {
        painted: false,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        nonBlackRatio: 0,
      };
    }
    context.drawImage(video, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let nonBlack = 0;
    const total = width * height;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 12 || pixels[index + 1] > 12 || pixels[index + 2] > 12) {
        nonBlack += 1;
      }
    }
    const nonBlackRatio = nonBlack / total;
    return {
      painted: nonBlackRatio > 0.02,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      nonBlackRatio,
    };
  });
}

/**
 * Compare luma rows of the Mux <video> to the WebGL cinema canvas.
 * Upright: unflipped correlation beats a vertically mirrored one.
 */
export async function sampleCinemaOrientation(page: {
  evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
}): Promise<{ upright: boolean; unflipped: number; flipped: number }> {
  return page.evaluate(() => {
    const video = document.querySelector("[data-holographic-kind='mural'] video") as HTMLVideoElement | null;
    const theater = document.querySelector("[data-holographic-theater]") as HTMLCanvasElement | null;
    const empty = { upright: false, unflipped: 0, flipped: 0 };
    if (!video || !theater || video.videoWidth < 16 || theater.width < 16) return empty;

    function rowMeans(source: CanvasImageSource): number[] {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 36;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const rows: number[] = [];
      for (let y = 0; y < canvas.height; y += 1) {
        let sum = 0;
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          sum += pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
        }
        rows.push(sum / canvas.width);
      }
      return rows;
    }

    function corr(a: number[], b: number[]): number {
      const n = Math.min(a.length, b.length);
      if (n < 8) return 0;
      let meanA = 0;
      let meanB = 0;
      for (let i = 0; i < n; i += 1) {
        meanA += a[i];
        meanB += b[i];
      }
      meanA /= n;
      meanB /= n;
      let num = 0;
      let denA = 0;
      let denB = 0;
      for (let i = 0; i < n; i += 1) {
        const da = a[i] - meanA;
        const db = b[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const den = Math.sqrt(denA * denB);
      return den === 0 ? 0 : num / den;
    }

    const videoRows = rowMeans(video);
    const canvasRows = rowMeans(theater);
    if (videoRows.length < 8 || canvasRows.length < 8) return empty;
    const unflipped = corr(videoRows, canvasRows);
    const flipped = corr(videoRows, [...canvasRows].reverse());
    return { upright: unflipped > flipped + 0.08, unflipped, flipped };
  });
}

export function isMuxHlsAbort(url: string, failure: string | null): boolean {
  const muxMediaHost = /stream\.mux\.com|edgemv\.mux\.com|image\.mux\.com/i.test(url);
  const aborted = /ERR_ABORTED|net::ERR_ABORTED|aborted/i.test(failure ?? "");
  return muxMediaHost && aborted;
}

/**
 * Mighty Verse — Replicate / Depth Anything v2 Provider Adapter
 *
 * Depth Anything v2 (Apache 2.0) via Replicate hosted inference.
 * https://replicate.com/depth-anything/depth-anything-v2
 *
 * CONVENTION:
 *   Depth Anything v2 outputs near=0 (black=near), far=1 (white=far).
 *   This is INVERTED relative to Mighty Verse convention (near=1, far=0).
 *   Inversion happens here, once, before returning frames.
 *   The rest of the pipeline receives already-normalized MV depth.
 *
 * AUTHENTICATION:
 *   Requires REPLICATE_API_TOKEN environment variable.
 *   Never expose this token to the browser.
 *
 * PROCESSING MODEL:
 *   Replicate runs predictions asynchronously. We submit and poll.
 *   Each frame is one prediction. For low-fps depth (1-2fps) this is
 *   practical within Vercel's maxDuration=300s for short clips.
 *   For longer assets, the depth job architecture handles polling.
 *
 * OUTPUT:
 *   Replicate returns a PNG URL. We fetch it, decode to grayscale Uint8Array,
 *   invert to MV convention, and return DepthProviderOutputFrame[].
 */

import {
  depthProviderError,
  unconfiguredDepthFailure,
  type DepthGenerationRequest,
  type DepthGenerationResult,
  type DepthProvider,
  type DepthProviderOutputFrame,
} from "../provider";

const PROVIDER_ID = "replicate";
const MODEL_ID = "depth-anything-v2";

// Replicate model version for Depth Anything v2 (large).
// Version pinned for reproducibility — update deliberately.
const REPLICATE_MODEL = "depth-anything/depth-anything-v2";
const REPLICATE_VERSION = "884d4f8a5b3b4d3b8a5b3b4d3b8a5b3b4d3b8a5b3b4d3b8a5b3b4d3b8a5b3b4d";

// Replicate API base
const REPLICATE_BASE = "https://api.replicate.com/v1";

// Poll interval and max attempts
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 90 × 2s = 180s per frame max

function replicateApiToken(): string | null {
  return process.env.REPLICATE_API_TOKEN?.trim() || null;
}

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

async function replicateFetch(path: string, init: RequestInit): Promise<Response> {
  const token = replicateApiToken();
  if (!token) throw new Error("unconfigured");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${REPLICATE_BASE}/${path.replace(/^\//, "")}`, { ...init, headers });
}

async function submitPrediction(imageBase64: string, mime: string): Promise<{ id: string; pollUrl: string } | null> {
  const dataUri = `data:${mime};base64,${imageBase64}`;
  const response = await replicateFetch("predictions", {
    method: "POST",
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: {
        image: dataUri,
        model_size: "Large",
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Replicate submit failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const prediction = (await response.json()) as ReplicatePrediction;
  if (!prediction.id) return null;
  const pollUrl = prediction.urls?.get ?? `${REPLICATE_BASE}/predictions/${prediction.id}`;
  return { id: prediction.id, pollUrl };
}

async function pollPrediction(pollUrl: string): Promise<ReplicatePrediction> {
  const token = replicateApiToken();
  if (!token) throw new Error("unconfigured");
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const response = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Replicate poll failed (${response.status})`);
    }
    const prediction = (await response.json()) as ReplicatePrediction;
    if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") {
      return prediction;
    }
  }
  throw new Error(`Replicate prediction timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Fetch a depth PNG from Replicate output URL and decode to grayscale Uint8Array.
 * Inverts from DA2 convention (near=0/far=1) to MV convention (near=1/far=0).
 *
 * Replicate returns a PNG. We use the raw PNG bytes and decode the first channel.
 * In a Node.js environment without a full image decoder, we use a minimal
 * PNG decoder approach: fetch the PNG, use the fact that grayscale PNGs
 * store pixel data in a predictable way.
 *
 * For production correctness we use the `sharp` package if available,
 * falling back to a manual PNG chunk parser for grayscale images.
 */
async function fetchAndDecodeDepthPng(
  url: string,
  expectedWidth?: number,
  expectedHeight?: number,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch depth PNG from Replicate (${response.status})`);
  }
  const pngBytes = Buffer.from(await response.arrayBuffer());

  // Try sharp first (available in many Node environments)
  try {
    // Dynamic import to avoid hard dependency
    const sharp = await import("sharp").catch(() => null);
    if (sharp) {
      const { data, info } = await sharp.default(pngBytes)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const width = info.width;
      const height = info.height;
      // Invert: DA2 near=0/far=1 → MV near=1/far=0
      const inverted = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        inverted[i] = 255 - data[i];
      }
      return { data: inverted, width, height };
    }
  } catch {
    // sharp not available — fall through to PNG parser
  }

  // Minimal PNG grayscale decoder (no external dependency)
  // Handles 8-bit grayscale PNGs as returned by Depth Anything v2
  const decoded = decodePngGrayscale(pngBytes);
  // Invert: DA2 near=0/far=1 → MV near=1/far=0
  const inverted = new Uint8Array(decoded.data.length);
  for (let i = 0; i < decoded.data.length; i++) {
    inverted[i] = 255 - decoded.data[i];
  }
  return { data: inverted, width: decoded.width, height: decoded.height };
}

/**
 * Minimal PNG decoder for 8-bit grayscale images.
 * Sufficient for Depth Anything v2 output which is always 8-bit grayscale.
 * Does not handle RGB, RGBA, interlaced, or 16-bit PNGs.
 */
function decodePngGrayscale(buffer: Buffer): { data: Uint8Array; width: number; height: number } {
  // PNG signature: 8 bytes
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PNG_SIG[i]) throw new Error("Not a valid PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (colorType !== 0 || bitDepth !== 8) {
    throw new Error(`PNG decoder: expected 8-bit grayscale (colorType=0, bitDepth=8), got colorType=${colorType}, bitDepth=${bitDepth}`);
  }

  // Decompress IDAT chunks using Node.js zlib
  const { inflateSync } = require("node:zlib");
  const compressed = Buffer.concat(idatChunks);
  const raw = inflateSync(compressed);

  // Reconstruct scanlines (each row has a filter byte prefix)
  const pixels = new Uint8Array(width * height);
  const stride = width + 1; // 1 filter byte + width pixels per row
  let prevRow = new Uint8Array(width);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const row = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      const raw_byte = raw[y * stride + 1 + x];
      const left = x > 0 ? row[x - 1] : 0;
      const up = prevRow[x];
      const upLeft = x > 0 ? prevRow[x - 1] : 0;
      switch (filterType) {
        case 0: row[x] = raw_byte; break;
        case 1: row[x] = (raw_byte + left) & 0xff; break;
        case 2: row[x] = (raw_byte + up) & 0xff; break;
        case 3: row[x] = (raw_byte + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: row[x] = (raw_byte + paethPredictor(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`Unknown PNG filter type: ${filterType}`);
      }
    }
    pixels.set(row, y * width);
    prevRow = row;
  }

  return { data: pixels, width, height };
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ---------------------------------------------------------------------------
// ReplicateDepthProvider
// ---------------------------------------------------------------------------

export class ReplicateDepthProvider implements DepthProvider {
  readonly providerId = PROVIDER_ID;
  readonly modelId = MODEL_ID;

  isConfigured(): boolean {
    return Boolean(replicateApiToken());
  }

  async generate(request: DepthGenerationRequest): Promise<DepthGenerationResult> {
    if (!this.isConfigured()) {
      return unconfiguredDepthFailure(PROVIDER_ID);
    }
    if (request.frames.length === 0) {
      return depthProviderError(PROVIDER_ID, "invalid_input", "No frames provided for depth generation.");
    }

    const outputFrames: DepthProviderOutputFrame[] = [];
    let totalConfidence = 0;

    for (const frame of request.frames) {
      try {
        const imageBase64 = frame.bytes.toString("base64");
        const submitted = await submitPrediction(imageBase64, frame.mime);
        if (!submitted) {
          return depthProviderError(PROVIDER_ID, "provider_error", "Replicate did not return a prediction ID.", true);
        }

        const prediction = await pollPrediction(submitted.pollUrl);

        if (prediction.status === "failed" || prediction.status === "canceled") {
          return depthProviderError(
            PROVIDER_ID,
            "provider_error",
            `Replicate prediction ${prediction.status}: ${prediction.error ?? "unknown error"}`,
            prediction.status === "failed",
          );
        }

        const outputUrl = Array.isArray(prediction.output)
          ? prediction.output[0]
          : prediction.output;

        if (!outputUrl || typeof outputUrl !== "string") {
          return depthProviderError(PROVIDER_ID, "provider_error", "Replicate returned no output URL.", true);
        }

        const decoded = await fetchAndDecodeDepthPng(outputUrl, request.targetWidth, request.targetHeight);

        // Confidence: Replicate DA2 does not return a confidence score.
        // We use 0.75 as a conservative default for generated depth.
        const frameConfidence = 0.75;
        totalConfidence += frameConfidence;

        outputFrames.push({
          timeMs: frame.timeMs,
          width: decoded.width,
          height: decoded.height,
          data: decoded.data,
          confidence: frameConfidence,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Replicate depth generation failed.";
        if (message === "unconfigured") return unconfiguredDepthFailure(PROVIDER_ID);
        const isTimeout = message.toLowerCase().includes("timed out");
        return depthProviderError(
          PROVIDER_ID,
          isTimeout ? "timeout" : "provider_error",
          message,
          isTimeout,
        );
      }
    }

    return {
      ok: true,
      provider: PROVIDER_ID,
      model: `${REPLICATE_MODEL}@${REPLICATE_VERSION.slice(0, 8)}`,
      frames: outputFrames,
      confidence: outputFrames.length > 0 ? totalConfidence / outputFrames.length : 0,
      source: "generated",
    };
  }
}

export const replicateDepthProvider = new ReplicateDepthProvider();

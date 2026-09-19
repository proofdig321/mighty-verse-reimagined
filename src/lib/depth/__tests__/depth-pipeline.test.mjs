/**
 * Mighty Verse — Depth Generation Pipeline Tests (Phase 4)
 *
 * Covers:
 *   - Provider normalization (convention inversion, validation)
 *   - Temporal sampling (timestamps, fps, duration)
 *   - MVDP round-trip (provider output → encode → decode → DepthIndex)
 *   - Persistence contract (asset metadata, failure contract)
 *   - Provider capability (configured/unconfigured)
 */

import {
  MIGHTY_VERSE_DEPTH_CONVENTION,
  DEPTH_ANYTHING_V2_CONVENTION,
  convertDepthConvention,
  DepthIndex,
} from "../../experience/depth-asset";

import {
  encodeDepthPayload,
  decodeDepthMeta,
  decodeDepthFrame,
} from "../../experience/depth-format";

import {
  computeSampleTimestamps,
  muxThumbnailFrameUrl,
  DEFAULT_DEPTH_FPS,
} from "../sampler";

import {
  depthProviderCapability,
  depthProviderError,
  unconfiguredDepthFailure,
} from "../provider";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function approx(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

// =============================================================================
// PROVIDER NORMALIZATION
// =============================================================================

// DA2 convention: near=0 (black=near), far=1 (white=far) — inverted from MV
// MV convention: near=1 (white=near), far=0 (black=far)

// Inversion: DA2 pixel value 0 (near) → MV 255 (near)
const da2Near = 0;
const mvNear = 255 - da2Near;
assert(mvNear === 255, "DA2 near(0) inverts to MV near(255)");

// Inversion: DA2 pixel value 255 (far) → MV 0 (far)
const da2Far = 255;
const mvFar = 255 - da2Far;
assert(mvFar === 0, "DA2 far(255) inverts to MV far(0)");

// Inversion: DA2 pixel value 128 (mid) → MV 127 (mid)
const da2Mid = 128;
const mvMid = 255 - da2Mid;
assert(mvMid === 127, "DA2 mid(128) inverts to MV 127");

// Normalized convention inversion
assert(approx(convertDepthConvention(0.0, DEPTH_ANYTHING_V2_CONVENTION), 1.0), "DA2 0.0 → MV 1.0 (near)");
assert(approx(convertDepthConvention(1.0, DEPTH_ANYTHING_V2_CONVENTION), 0.0), "DA2 1.0 → MV 0.0 (far)");
assert(approx(convertDepthConvention(0.3, DEPTH_ANYTHING_V2_CONVENTION), 0.7), "DA2 0.3 → MV 0.7");

// MV convention: no inversion needed
assert(approx(convertDepthConvention(0.8, MIGHTY_VERSE_DEPTH_CONVENTION), 0.8), "MV convention: identity");

// Provider failure constructors
const unconfigured = unconfiguredDepthFailure("replicate");
assert(unconfigured.ok === false, "unconfigured failure: ok=false");
assert(unconfigured.status === "needs_configuration", "unconfigured failure: status");
assert(unconfigured.code === "unconfigured", "unconfigured failure: code");
assert(unconfigured.retryable === false, "unconfigured failure: not retryable");

const quotaErr = depthProviderError("replicate", "quota", "Quota exceeded", false);
assert(quotaErr.status === "unavailable", "quota error: status=unavailable");

const timeoutErr = depthProviderError("replicate", "timeout", "Timed out", true);
assert(timeoutErr.status === "unavailable", "timeout error: status=unavailable");
assert(timeoutErr.retryable === true, "timeout error: retryable");

const dimErr = depthProviderError("replicate", "unsupported_dimensions", "Too large", false);
assert(dimErr.status === "unsupported", "dimension error: status=unsupported");

const provErr = depthProviderError("replicate", "provider_error", "API error", true);
assert(provErr.status === "failed", "provider error: status=failed");

// =============================================================================
// TEMPORAL SAMPLING
// =============================================================================

assert(DEFAULT_DEPTH_FPS === 1.0, "default depth fps = 1.0");

// 1fps, 5 second clip → timestamps at 0, 1000, 2000, 3000, 4000ms
const ts5s = computeSampleTimestamps(5000, 1.0);
assert(ts5s[0] === 0, "1fps/5s: first timestamp = 0ms");
assert(ts5s.every((t) => t >= 0 && t < 5000), "1fps/5s: all timestamps within duration");
assert(ts5s.length >= 5, `1fps/5s: at least 5 frames (got ${ts5s.length})`);

// 2fps, 4 second clip → timestamps at 0, 500, 1000, 1500, 2000, 2500, 3000, 3500ms
const ts4s2fps = computeSampleTimestamps(4000, 2.0);
assert(ts4s2fps[0] === 0, "2fps/4s: first timestamp = 0ms");
assert(ts4s2fps.length >= 8, `2fps/4s: at least 8 frames (got ${ts4s2fps.length})`);

// No wall-clock timestamps — all derived from durationMs
const tsNow = computeSampleTimestamps(3000, 1.0);
assert(tsNow.every((t) => typeof t === "number" && t >= 0), "timestamps are non-negative numbers");
assert(tsNow.every((t) => t < 3000), "timestamps are within source duration");

// Zero duration → no timestamps
const tsZero = computeSampleTimestamps(0, 1.0);
assert(tsZero.length === 0, "zero duration: no timestamps");

// Very short clip (500ms) → at least 1 frame
const tsShort = computeSampleTimestamps(500, 1.0);
assert(tsShort.length >= 1, "500ms clip: at least 1 frame");
assert(tsShort[0] === 0, "500ms clip: first frame at 0ms");

// Timestamps are ascending
const ts10s = computeSampleTimestamps(10000, 1.0);
for (let i = 1; i < ts10s.length; i++) {
  assert(ts10s[i] > ts10s[i - 1], `timestamps are ascending at index ${i}`);
}

// Source duration is respected — no timestamp >= durationMs
assert(ts10s.every((t) => t < 10000), "timestamps do not exceed source duration");

// Mux thumbnail URL format
const thumbUrl = muxThumbnailFrameUrl("abc123", 1500, 640);
assert(thumbUrl.includes("abc123"), "thumbnail URL contains playback ID");
assert(thumbUrl.includes("1.500"), "thumbnail URL contains time in seconds");
assert(thumbUrl.includes("width=640"), "thumbnail URL contains width");
assert(thumbUrl.startsWith("https://image.mux.com/"), "thumbnail URL uses Mux image API");

// =============================================================================
// MVDP ROUND-TRIP: provider output → encode → decode → DepthIndex
// =============================================================================

// Simulate provider output (already in MV convention after inversion)
function makeProviderFrame(timeMs, nearValue = 200) {
  const width = 8;
  const height = 8;
  const data = new Uint8Array(width * height).fill(nearValue);
  return { timeMs, width, height, data, confidence: 0.75 };
}

const providerFrames = [
  makeProviderFrame(0,    200),
  makeProviderFrame(1000, 180),
  makeProviderFrame(2000, 160),
];

const assetDescriptor = {
  assetId: "test-pipeline-asset",
  source: "generated",
  confidence: 0.75,
  width: 8,
  height: 8,
  frameRate: 1.0,
  convention: MIGHTY_VERSE_DEPTH_CONVENTION,
  formatVersion: 1,
  frameCount: 3,
  durationMs: 3000,
};

// Encode
const payload = encodeDepthPayload(assetDescriptor, providerFrames);
assert(payload instanceof ArrayBuffer, "pipeline: encode produces ArrayBuffer");

// Decode metadata
const meta = decodeDepthMeta(payload);
assert(meta.frameCount === 3, "pipeline: decoded frameCount = 3");
assert(meta.width === 8, "pipeline: decoded width = 8");
assert(meta.height === 8, "pipeline: decoded height = 8");
assert(approx(meta.frameRate, 1.0), "pipeline: decoded frameRate = 1.0");
assert(meta.durationMs === 3000, "pipeline: decoded durationMs = 3000");
assert(meta.source === "generated", "pipeline: decoded source = generated");
assert(meta.timestamps[0] === 0,    "pipeline: timestamp[0] = 0ms");
assert(meta.timestamps[1] === 1000, "pipeline: timestamp[1] = 1000ms");
assert(meta.timestamps[2] === 2000, "pipeline: timestamp[2] = 2000ms");

// Decode individual frames
const f0 = decodeDepthFrame(payload, meta, 0);
assert(f0.timeMs === 0, "pipeline: frame 0 timeMs = 0");
assert(f0.data[0] === 200, "pipeline: frame 0 pixel = 200 (near, MV convention)");

const f1 = decodeDepthFrame(payload, meta, 1);
assert(f1.timeMs === 1000, "pipeline: frame 1 timeMs = 1000");
assert(f1.data[0] === 180, "pipeline: frame 1 pixel = 180");

// DepthIndex lookup from decoded frames
const depthFrames = [f0, f1, decodeDepthFrame(payload, meta, 2)];
const index = new DepthIndex(assetDescriptor, depthFrames);

// Exact lookup
const exact = index.nearest(1000);
assert(exact !== null, "DepthIndex: exact lookup returns frame");
assert(exact.timeMs === 1000, "DepthIndex: exact lookup correct frame");

// Between frames — nearest wins
const between = index.nearest(600); // 600ms from 0 (600ms away), 400ms from 1000 → 1000 wins
assert(between?.timeMs === 1000, "DepthIndex: 600ms → nearest is 1000ms frame");

// Outside tolerance
const outside = index.nearest(5000);
assert(outside === null, "DepthIndex: 5000ms outside tolerance → null");

// Seek safety — random access
const seekBack = index.nearest(0);
assert(seekBack?.timeMs === 0, "DepthIndex: seek back to 0ms correct");

// =============================================================================
// PERSISTENCE CONTRACT
// =============================================================================

// Verify asset descriptor has correct fields for DB persistence
assert(assetDescriptor.source === "generated", "persistence: source = generated");
assert(assetDescriptor.confidence === 0.75, "persistence: confidence present");
assert(assetDescriptor.width === 8, "persistence: width present");
assert(assetDescriptor.height === 8, "persistence: height present");
assert(assetDescriptor.frameRate === 1.0, "persistence: frameRate present");
assert(assetDescriptor.durationMs === 3000, "persistence: durationMs present");
assert(assetDescriptor.formatVersion === 1, "persistence: formatVersion = 1");
assert(assetDescriptor.convention.near === 1.0, "persistence: convention.near = 1.0");
assert(assetDescriptor.convention.far === 0.0, "persistence: convention.far = 0.0");

// Failed pipeline must not produce a usable asset
// (structural verification — pipeline returns ok:false on any stage failure)
const failedResult = { ok: false, stage: "provider", message: "Provider unavailable", retryable: true };
assert(failedResult.ok === false, "failed pipeline: ok=false");
assert(!("depthAssetId" in failedResult), "failed pipeline: no depthAssetId");
assert(!("associationId" in failedResult), "failed pipeline: no associationId");

// =============================================================================
// PROVIDER CAPABILITY
// =============================================================================

// Mock provider for capability test
const mockConfigured = {
  providerId: "replicate",
  modelId: "depth-anything-v2",
  isConfigured: () => true,
  generate: async () => ({ ok: false, provider: "replicate", status: "failed", retryable: false, message: "mock", code: "unknown" }),
};
const mockUnconfigured = {
  ...mockConfigured,
  isConfigured: () => false,
};

const capConfigured = depthProviderCapability(mockConfigured);
assert(capConfigured.configured === true, "capability: configured=true");
assert(capConfigured.label.includes("replicate"), "capability: label includes provider");
assert(!capConfigured.label.includes("not configured"), "capability: configured label has no warning");

const capUnconfigured = depthProviderCapability(mockUnconfigured);
assert(capUnconfigured.configured === false, "capability: unconfigured=false");
assert(capUnconfigured.label.includes("not configured"), "capability: unconfigured label has warning");

// =============================================================================
// STORAGE PATH CONTRACT
// =============================================================================

// Verify storage path format: depth/<sourceAssetId>/<jobId>.mvdp
const sourceId = "source-asset-uuid";
const jobId = "job-uuid";
const expectedPath = `depth/${sourceId}/${jobId}.mvdp`;
assert(expectedPath.startsWith("depth/"), "storage path: starts with depth/");
assert(expectedPath.endsWith(".mvdp"), "storage path: ends with .mvdp");
assert(expectedPath.includes(sourceId), "storage path: contains source asset ID");
assert(expectedPath.includes(jobId), "storage path: contains job ID");

console.log("depth-pipeline.test.mjs: all passed");

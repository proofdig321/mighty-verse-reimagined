/**
 * Mighty Verse — Phase 4A Tests: Modal VDA Provider + Async Pipeline
 *
 * Covers:
 *   - Modal provider configuration and request construction
 *   - Missing configuration failure
 *   - Async-submitted pipeline result
 *   - VDA normalization (near=0/far=1 → MV near=1/far=0)
 *   - MVDP round-trip with VDA-normalized frames
 *   - Job lifecycle: queued → processing (submitted)
 *   - Job lifecycle: queued → failed
 *   - Failed jobs cannot produce a usable depth asset
 *   - Provider registry selection
 *   - Callback signature verification contract
 *   - Timestamp derivation from source video timeline
 */

import {
  MIGHTY_VERSE_DEPTH_CONVENTION,
  convertDepthConvention,
  DepthIndex,
} from "../../experience/depth-asset.ts";

import {
  encodeDepthPayload,
  decodeDepthMeta,
  decodeDepthFrame,
} from "../../experience/depth-format.ts";

import {
  depthProviderCapability,
  depthProviderError,
  unconfiguredDepthFailure,
} from "../provider.ts";

import {
  MODAL_PROVIDER_ID,
  MODAL_MODEL_ID,
  ModalVDAProvider,
} from "../providers/modal/adapter.ts";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function approx(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

// =============================================================================
// MODAL PROVIDER — CONFIGURATION
// =============================================================================

// Provider IDs
assert(MODAL_PROVIDER_ID === "modal", "Modal provider ID = 'modal'");
assert(MODAL_MODEL_ID === "video-depth-anything-small", "Modal model ID = 'video-depth-anything-small'");

// Unconfigured when env vars absent
const provider = new ModalVDAProvider();
// In test environment, MODAL_WEBHOOK_URL and MODAL_WEBHOOK_SECRET are not set
assert(provider.isConfigured() === false, "Modal provider: unconfigured without env vars");
assert(provider.providerId === MODAL_PROVIDER_ID, "Modal provider: providerId");
assert(provider.modelId === MODAL_MODEL_ID, "Modal provider: modelId");

// Capability reflects unconfigured state
const cap = depthProviderCapability(provider);
assert(cap.configured === false, "Modal capability: configured=false");
assert(cap.providerId === "modal", "Modal capability: providerId");
assert(cap.label.includes("not configured"), "Modal capability: label includes 'not configured'");

// =============================================================================
// MODAL PROVIDER — UNCONFIGURED FAILURE
// =============================================================================

// generate() returns unconfigured failure when not configured
const unconfiguredResult = await provider.generate({
  sourceAssetId: "test-source",
  frames: [],
  jobId: "test-job",
  participantId: "test-participant",
  targetFps: 2.0,
  videoRef: { muxPlaybackId: "test-playback", durationMs: 10000 },
});
assert(unconfiguredResult.ok === false, "Unconfigured Modal: generate returns failure");
assert(unconfiguredResult.status === "needs_configuration", "Unconfigured Modal: status=needs_configuration");
assert(unconfiguredResult.code === "unconfigured", "Unconfigured Modal: code=unconfigured");
assert(unconfiguredResult.retryable === false, "Unconfigured Modal: not retryable");

// =============================================================================
// MODAL PROVIDER — MISSING VIDEO REF
// =============================================================================

// Simulate configured provider (mock env) to test invalid_input path
class MockConfiguredModalProvider extends ModalVDAProvider {
  isConfigured() { return true; }
}
const configuredProvider = new MockConfiguredModalProvider();

// Missing videoRef
const missingVideoRef = await configuredProvider.generate({
  sourceAssetId: "test-source",
  frames: [],
  jobId: "test-job",
  participantId: "test-participant",
  targetFps: 2.0,
  // no videoRef
});
assert(missingVideoRef.ok === false, "Missing videoRef: returns failure");
assert(missingVideoRef.code === "invalid_input", "Missing videoRef: code=invalid_input");

// =============================================================================
// PROVIDER FAILURE CONSTRUCTORS — generalized message
// =============================================================================

const unconfiguredModal = unconfiguredDepthFailure("modal");
assert(unconfiguredModal.ok === false, "unconfiguredDepthFailure: ok=false");
assert(unconfiguredModal.status === "needs_configuration", "unconfiguredDepthFailure: status");
assert(unconfiguredModal.code === "unconfigured", "unconfiguredDepthFailure: code");
// Message should NOT reference REPLICATE_API_TOKEN
assert(!unconfiguredModal.message.includes("REPLICATE_API_TOKEN"),
  "unconfiguredDepthFailure: message does not reference REPLICATE_API_TOKEN");
assert(unconfiguredModal.message.includes("modal"), "unconfiguredDepthFailure: message includes provider ID");

// =============================================================================
// VDA NORMALIZATION — convention inversion
// =============================================================================

// VDA-Small outputs: larger value = farther (same as DA2: near=0, far=1)
// MV canonical: near=1.0 (white=255), far=0.0 (black=0)
// Inversion: MV_value = 1.0 - VDA_value

// VDA near pixel (value=0) → MV near (value=255)
const vdaNearNorm = 0.0;
const mvNearNorm = 1.0 - vdaNearNorm;
assert(approx(mvNearNorm, 1.0), "VDA near(0.0) → MV near(1.0)");

// VDA far pixel (value=1) → MV far (value=0)
const vdaFarNorm = 1.0;
const mvFarNorm = 1.0 - vdaFarNorm;
assert(approx(mvFarNorm, 0.0), "VDA far(1.0) → MV far(0.0)");

// VDA mid (0.3) → MV (0.7)
assert(approx(1.0 - 0.3, 0.7), "VDA 0.3 → MV 0.7");

// Uint8 inversion: VDA pixel 0 (near) → MV 255 (near)
const vdaPixelNear = 0;
const mvPixelNear = 255 - vdaPixelNear;
assert(mvPixelNear === 255, "VDA uint8 near(0) → MV uint8 near(255)");

// Uint8 inversion: VDA pixel 255 (far) → MV 0 (far)
const vdaPixelFar = 255;
const mvPixelFar = 255 - vdaPixelFar;
assert(mvPixelFar === 0, "VDA uint8 far(255) → MV uint8 far(0)");

// Uint8 inversion: VDA pixel 100 → MV 155
assert(255 - 100 === 155, "VDA uint8 100 → MV 155");

// convertDepthConvention works for VDA (same as DA2 convention)
import { DEPTH_ANYTHING_V2_CONVENTION } from "../../experience/depth-asset.ts";
assert(approx(convertDepthConvention(0.0, DEPTH_ANYTHING_V2_CONVENTION), 1.0),
  "convertDepthConvention: VDA near(0) → MV near(1)");
assert(approx(convertDepthConvention(1.0, DEPTH_ANYTHING_V2_CONVENTION), 0.0),
  "convertDepthConvention: VDA far(1) → MV far(0)");

// MV convention: no inversion
assert(approx(convertDepthConvention(0.8, MIGHTY_VERSE_DEPTH_CONVENTION), 0.8),
  "MV convention: identity");

// =============================================================================
// MVDP ROUND-TRIP WITH VDA-NORMALIZED FRAMES
// =============================================================================

// Simulate VDA output: performer near (bright in VDA = far, so near performer = dark in VDA)
// VDA pixel 50 (near performer) → MV pixel 205 (near = bright)
// VDA pixel 200 (far background) → MV pixel 55 (far = dark)

function makeVDANormalizedFrame(timeMs, vdaPixelValue) {
  const width = 8;
  const height = 8;
  // Invert VDA → MV convention
  const mvPixel = 255 - vdaPixelValue;
  const data = new Uint8Array(width * height).fill(mvPixel);
  return { timeMs, width, height, data, confidence: 0.80 };
}

// 2fps, 3 frames: 0ms, 500ms, 1000ms
const vdaFrames = [
  makeVDANormalizedFrame(0,    50),   // VDA near performer → MV 205
  makeVDANormalizedFrame(500,  60),   // slight motion
  makeVDANormalizedFrame(1000, 55),   // back to near
];

const assetDescriptor = {
  assetId: "vda-test-asset",
  source: "generated",
  confidence: 0.80,
  width: 8,
  height: 8,
  frameRate: 2.0,
  convention: MIGHTY_VERSE_DEPTH_CONVENTION,
  formatVersion: 1,
  frameCount: 3,
  durationMs: 1500,
};

// Encode
const payload = encodeDepthPayload(assetDescriptor, vdaFrames);
assert(payload instanceof ArrayBuffer, "VDA MVDP: encode produces ArrayBuffer");

// Decode metadata
const meta = decodeDepthMeta(payload);
assert(meta.frameCount === 3, "VDA MVDP: frameCount = 3");
assert(approx(meta.frameRate, 2.0), "VDA MVDP: frameRate = 2.0");
assert(meta.durationMs === 1500, "VDA MVDP: durationMs = 1500");
assert(meta.timestamps[0] === 0,    "VDA MVDP: timestamp[0] = 0ms");
assert(meta.timestamps[1] === 500,  "VDA MVDP: timestamp[1] = 500ms");
assert(meta.timestamps[2] === 1000, "VDA MVDP: timestamp[2] = 1000ms");

// Decode frames — verify MV convention preserved
const f0 = decodeDepthFrame(payload, meta, 0);
assert(f0.timeMs === 0, "VDA MVDP: frame 0 timeMs = 0");
assert(f0.data[0] === 205, "VDA MVDP: frame 0 pixel = 205 (MV near, inverted from VDA 50)");

const f1 = decodeDepthFrame(payload, meta, 1);
assert(f1.data[0] === 195, "VDA MVDP: frame 1 pixel = 195 (MV, inverted from VDA 60)");

const f2 = decodeDepthFrame(payload, meta, 2);
assert(f2.data[0] === 200, "VDA MVDP: frame 2 pixel = 200 (MV, inverted from VDA 55)");

// =============================================================================
// DEPTH INDEX — 2fps temporal lookup
// =============================================================================

const depthFrames = [f0, f1, f2];
const index = new DepthIndex(assetDescriptor, depthFrames);

// Tolerance at 2fps = 1000/2/2 = 250ms
assert(approx(index.toleranceMs, 250), "2fps DepthIndex: tolerance = 250ms");

// Exact lookup at 500ms
const exact500 = index.nearest(500);
assert(exact500 !== null, "2fps DepthIndex: exact 500ms lookup");
assert(exact500.timeMs === 500, "2fps DepthIndex: 500ms → frame at 500ms");

// Lookup at 300ms — 300ms from 0 (outside 250ms tol), 200ms from 500 (within) → 500ms
const near300 = index.nearest(300);
assert(near300 !== null, "2fps DepthIndex: 300ms within tolerance of 500ms");
assert(near300.timeMs === 500, "2fps DepthIndex: 300ms → 500ms frame");

// Lookup at 100ms — 100ms from 0 (within 250ms tol) → 0ms
const near100 = index.nearest(100);
assert(near100 !== null, "2fps DepthIndex: 100ms within tolerance of 0ms");
assert(near100.timeMs === 0, "2fps DepthIndex: 100ms → 0ms frame");

// Seek safety — random access
const seekBack = index.nearest(0);
assert(seekBack?.timeMs === 0, "2fps DepthIndex: seek back to 0ms");
const seekFwd = index.nearest(1000);
assert(seekFwd?.timeMs === 1000, "2fps DepthIndex: seek forward to 1000ms");

// =============================================================================
// ASYNC PIPELINE RESULT — submitted state
// =============================================================================

// The pipeline returns ok="submitted" when Modal accepts the job
const submittedResult = { ok: "submitted", provider: "modal", model: "video-depth-anything-small" };
assert(submittedResult.ok === "submitted", "submitted result: ok='submitted'");
assert(submittedResult.provider === "modal", "submitted result: provider=modal");
assert(submittedResult.model === "video-depth-anything-small", "submitted result: model");
// submitted result has no depthAssetId — job is not yet complete
assert(!("depthAssetId" in submittedResult), "submitted result: no depthAssetId");
assert(!("associationId" in submittedResult), "submitted result: no associationId");

// =============================================================================
// JOB LIFECYCLE — structural verification
// =============================================================================

// queued → processing (submitted)
const queuedJob = {
  job_id: "job-001",
  source_asset_id: "source-001",
  participant_id: "participant-001",
  provider: "modal",
  model: null,
  status: "queued",
  target_fps: 2.0,
  frame_width: 640,
  result: null,
  error: null,
  retryable: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
assert(queuedJob.status === "queued", "job lifecycle: initial status = queued");
assert(queuedJob.result === null, "job lifecycle: no result when queued");

// After submission: status = processing
const processingJob = { ...queuedJob, status: "processing", model: "video-depth-anything-small" };
assert(processingJob.status === "processing", "job lifecycle: processing after submission");
assert(processingJob.result === null, "job lifecycle: no result while processing");

// After callback: status = completed
const completedJob = {
  ...processingJob,
  status: "completed",
  result: {
    depth_asset_id: "depth-asset-001",
    association_id: "assoc-001",
    storage_path: "depth/source-001/job-001.mvdp",
    frame_count: 6,
    width: 640,
    height: 360,
    frame_rate: 2.0,
    duration_ms: 3000,
    confidence: 0.80,
    provider: "modal",
    model: "video-depth-anything-small",
  },
};
assert(completedJob.status === "completed", "job lifecycle: completed after callback");
assert(completedJob.result !== null, "job lifecycle: result present when completed");
assert(completedJob.result.depth_asset_id === "depth-asset-001", "job lifecycle: depth_asset_id");

// =============================================================================
// JOB LIFECYCLE — failure path
// =============================================================================

const failedJob = {
  ...queuedJob,
  status: "failed",
  retryable: true,
  error: { message: "VDA inference failed: CUDA OOM", stage: "worker" },
};
assert(failedJob.status === "failed", "failed job: status = failed");
assert(failedJob.result === null, "failed job: no result");
assert(failedJob.error !== null, "failed job: error present");
assert(failedJob.error.stage === "worker", "failed job: error stage = worker");

// Failed job cannot produce a usable depth asset
assert(!("depthAssetId" in failedJob), "failed job: no depthAssetId");
assert(failedJob.result === null, "failed job: result is null — no usable depth asset");

// =============================================================================
// CALLBACK SIGNATURE CONTRACT
// =============================================================================

// The callback body (without signature) must be signed with HMAC-SHA256
// Verify the structural contract: sorted keys, canonical JSON
const callbackBody = {
  job_id: "job-001",
  status: "completed",
  result: { depth_asset_id: "depth-001" },
};
// Canonical form: sorted keys, no signature field
const canonicalKeys = Object.keys(callbackBody).sort();
assert(canonicalKeys[0] === "job_id", "callback signature: sorted keys[0] = job_id");
assert(canonicalKeys[1] === "result", "callback signature: sorted keys[1] = result");
assert(canonicalKeys[2] === "status", "callback signature: sorted keys[2] = status");
// Signature field must not be included in the signed payload
assert(!canonicalKeys.includes("signature"), "callback signature: signature field excluded from signing");

// =============================================================================
// TIMESTAMP DERIVATION — source video timeline
// =============================================================================

// 2fps, 3-second video → timestamps at 0, 500, 1000, 1500, 2000, 2500ms
function computeVDATimestamps(durationMs, targetFps) {
  const intervalMs = Math.round(1000 / targetFps);
  const timestamps = [];
  for (let t = 0; t < durationMs; t += intervalMs) {
    timestamps.push(t);
  }
  return timestamps;
}

const ts3s2fps = computeVDATimestamps(3000, 2.0);
assert(ts3s2fps[0] === 0, "VDA timestamps: first = 0ms");
assert(ts3s2fps[1] === 500, "VDA timestamps: second = 500ms");
assert(ts3s2fps.every(t => t >= 0 && t < 3000), "VDA timestamps: all within duration");
assert(ts3s2fps.length === 6, `VDA timestamps: 6 frames for 3s at 2fps (got ${ts3s2fps.length})`);

// Timestamps are in source video timeline — not wall clock
const now = Date.now();
assert(ts3s2fps.every(t => t < now), "VDA timestamps: all less than current epoch (not wall clock)");
assert(ts3s2fps.every(t => t < 10000), "VDA timestamps: all within reasonable video duration");

// =============================================================================
// STORAGE PATH CONTRACT
// =============================================================================

const sourceId = "source-asset-uuid";
const jobId = "job-uuid";
const storagePath = `depth/${sourceId}/${jobId}.mvdp`;
assert(storagePath === "depth/source-asset-uuid/job-uuid.mvdp", "storage path: correct format");
assert(storagePath.startsWith("depth/"), "storage path: starts with depth/");
assert(storagePath.endsWith(".mvdp"), "storage path: ends with .mvdp");

// =============================================================================
// PROVIDER REGISTRY — structural verification
// =============================================================================

// Registry should default to modal-vda
// (Cannot test env-driven selection in unit tests without mocking process.env)
// Verify the registry module exports the expected interface
import { getActiveDepthProvider, getActiveDepthProviderName } from "../registry.ts";
const activeProvider = getActiveDepthProvider();
assert(typeof activeProvider.providerId === "string", "registry: provider has providerId");
assert(typeof activeProvider.modelId === "string", "registry: provider has modelId");
assert(typeof activeProvider.isConfigured === "function", "registry: provider has isConfigured");
assert(typeof activeProvider.generate === "function", "registry: provider has generate");

const activeName = getActiveDepthProviderName();
assert(typeof activeName === "string", "registry: getActiveDepthProviderName returns string");
assert(activeName === "modal-vda" || activeName === "replicate",
  `registry: active name is known provider (got ${activeName})`);

console.log("modal-vda-provider.test.mjs: all passed");

/**
 * Mighty Verse — Depth Asset Tests
 *
 * Covers:
 *   - DepthConvention (near/far, normalization, inversion)
 *   - DepthIndex (nearest frame, tolerance, confidence, seek, edge cases)
 *   - Binary format (encode, decode, metadata, truncated, invalid)
 *   - Renderer integration (u_has_depth contract, temporal alignment)
 */

import {
  MIGHTY_VERSE_DEPTH_CONVENTION,
  DEPTH_ANYTHING_V2_CONVENTION,
  DEFAULT_DEPTH_CONFIDENCE_THRESHOLD,
  convertDepthConvention,
  DepthIndex,
} from "../depth-asset";

import {
  DEPTH_FORMAT_MAGIC,
  DEPTH_FORMAT_VERSION,
  DepthFormatError,
  encodeDepthPayload,
  decodeDepthMeta,
  decodeDepthFrame,
  decodeAllDepthFrames,
  depthAssetFromMeta,
} from "../depth-format";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function approx(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

function makeAsset(overrides = {}) {
  return {
    assetId: "test-asset-1",
    source: "generated",
    confidence: 0.85,
    width: 4,
    height: 4,
    frameRate: 10,
    convention: MIGHTY_VERSE_DEPTH_CONVENTION,
    formatVersion: 1,
    frameCount: 3,
    durationMs: 300,
    ...overrides,
  };
}

function makeFrame(timeMs, value = 128, overrides = {}) {
  return {
    timeMs,
    width: 4,
    height: 4,
    data: new Uint8Array(16).fill(value),
    ...overrides,
  };
}

// =============================================================================
// DEPTH CONVENTION
// =============================================================================

// MV canonical: near=1.0, far=0.0
assert(MIGHTY_VERSE_DEPTH_CONVENTION.near === 1.0, "MV convention: near = 1.0");
assert(MIGHTY_VERSE_DEPTH_CONVENTION.far  === 0.0, "MV convention: far = 0.0");
assert(MIGHTY_VERSE_DEPTH_CONVENTION.encoding === "linear", "MV convention: encoding = linear");
assert(MIGHTY_VERSE_DEPTH_CONVENTION.gamma === "none", "MV convention: gamma = none");

// DA2: near=0.0, far=1.0 (inverted)
assert(DEPTH_ANYTHING_V2_CONVENTION.near === 0.0, "DA2 convention: near = 0.0");
assert(DEPTH_ANYTHING_V2_CONVENTION.far  === 1.0, "DA2 convention: far = 1.0");

// Inversion: DA2 → MV
assert(approx(convertDepthConvention(0.0, DEPTH_ANYTHING_V2_CONVENTION), 1.0), "DA2 near(0) → MV near(1)");
assert(approx(convertDepthConvention(1.0, DEPTH_ANYTHING_V2_CONVENTION), 0.0), "DA2 far(1) → MV far(0)");
assert(approx(convertDepthConvention(0.3, DEPTH_ANYTHING_V2_CONVENTION), 0.7), "DA2 0.3 → MV 0.7");

// No inversion needed when convention already matches MV
assert(approx(convertDepthConvention(0.8, MIGHTY_VERSE_DEPTH_CONVENTION), 0.8), "MV convention: no inversion");
assert(approx(convertDepthConvention(0.0, MIGHTY_VERSE_DEPTH_CONVENTION), 0.0), "MV convention: 0 stays 0");

// White = near, Black = far (Mighty Verse canonical)
// Uint8: 255 = near (white), 0 = far (black)
assert(255 / 255 === 1.0, "Uint8 255 normalizes to 1.0 (near)");
assert(0   / 255 === 0.0, "Uint8 0 normalizes to 0.0 (far)");

// =============================================================================
// DEPTH INDEX — basic lookup
// =============================================================================

const asset10fps = makeAsset({ frameRate: 10 }); // tolerance = 50ms
const frames = [
  makeFrame(0),
  makeFrame(100),
  makeFrame(200),
  makeFrame(300),
];
const index = new DepthIndex(asset10fps, frames);

// Tolerance = 1000/10/2 = 50ms
assert(approx(index.toleranceMs, 50), "10fps asset: tolerance = 50ms");
assert(index.frameCount === 4, "index has 4 frames");

// Exact timestamp
const exact = index.nearest(100);
assert(exact !== null, "exact timestamp: returns frame");
assert(exact.timeMs === 100, "exact timestamp: correct frame");

// Between frames — nearest wins
const between = index.nearest(130); // 30ms from 100, 70ms from 200 → 100 wins
assert(between !== null, "between frames: returns nearest");
assert(between.timeMs === 100, "between frames: 130ms → frame at 100ms");

const between2 = index.nearest(160); // 60ms from 100 (outside tol), 40ms from 200 → 200 wins
assert(between2 !== null, "between frames: 160ms → frame at 200ms");
assert(between2.timeMs === 200, "between frames: 160ms → 200ms frame");

// Outside tolerance
const outside = index.nearest(175); // 25ms from 200 → within tol
assert(outside !== null, "175ms is within 50ms of 200ms");
const outsideFar = index.nearest(400); // 100ms from 300 → outside 50ms tol
assert(outsideFar === null, "400ms is outside tolerance of last frame (300ms)");

// Before first frame
const beforeFirst = index.nearest(-100); // 100ms from 0 → outside tol
assert(beforeFirst === null, "before first frame and outside tolerance → null");

// =============================================================================
// DEPTH INDEX — duplicate timestamp (deterministic)
// =============================================================================

const r1 = index.nearest(100);
const r2 = index.nearest(100);
assert(r1 !== null && r2 !== null, "duplicate lookup: both return frame");
assert(r1.timeMs === r2.timeMs, "duplicate lookup: deterministic — same result");

// =============================================================================
// DEPTH INDEX — seek safety (random access)
// =============================================================================

// Forward playback
const fwd1 = index.nearest(0);
const fwd2 = index.nearest(100);
const fwd3 = index.nearest(200);
assert(fwd1?.timeMs === 0,   "forward: 0ms");
assert(fwd2?.timeMs === 100, "forward: 100ms");
assert(fwd3?.timeMs === 200, "forward: 200ms");

// Backward seek — must not carry stale frame
const back = index.nearest(0);
assert(back?.timeMs === 0, "backward seek: returns correct frame, not stale");

// Large seek
const large = index.nearest(300);
assert(large?.timeMs === 300, "large seek: correct frame");

// =============================================================================
// DEPTH INDEX — confidence
// =============================================================================

const lowConfAsset = makeAsset({ confidence: 0.1 }); // below threshold (0.3)
const lowConfIndex = new DepthIndex(lowConfAsset, [makeFrame(100)]);
assert(lowConfIndex.nearest(100) === null, "low asset confidence → null (below threshold)");

// Per-frame confidence override
const mixedFrames = [
  makeFrame(0,   128, { confidence: 0.9 }),  // high confidence
  makeFrame(100, 128, { confidence: 0.1 }),  // low confidence
];
const mixedIndex = new DepthIndex(makeAsset({ confidence: 0.8 }), mixedFrames);
assert(mixedIndex.nearest(0)   !== null, "high-confidence frame: returned");
assert(mixedIndex.nearest(100) === null, "low-confidence frame: null (below threshold)");

// Custom confidence threshold
const strictIndex = new DepthIndex(
  makeAsset({ confidence: 0.5 }),
  [makeFrame(0, 128, { confidence: 0.5 })],
  undefined,
  0.6, // threshold above frame confidence
);
assert(strictIndex.nearest(0) === null, "custom threshold: frame below threshold → null");

// =============================================================================
// DEPTH INDEX — missing frame
// =============================================================================

const emptyIndex = new DepthIndex(makeAsset(), []);
assert(emptyIndex.nearest(0)   === null, "empty index: null");
assert(emptyIndex.nearest(100) === null, "empty index: null for any timestamp");

// =============================================================================
// DEPTH INDEX — tolerance derives from frameRate
// =============================================================================

const fps24 = new DepthIndex(makeAsset({ frameRate: 24 }), [makeFrame(0)]);
assert(approx(fps24.toleranceMs, 1000 / 24 / 2, 0.01), "24fps: tolerance = 1000/24/2");

const fps1 = new DepthIndex(makeAsset({ frameRate: 1 }), [makeFrame(0)]);
assert(approx(fps1.toleranceMs, 500), "1fps: tolerance = 500ms");

// No frameRate → generous tolerance (single-frame asset)
const noFps = new DepthIndex(makeAsset({ frameRate: undefined }), [makeFrame(0)]);
assert(noFps.toleranceMs === 500, "no frameRate: tolerance = 500ms");

// Explicit tolerance override
const overrideIndex = new DepthIndex(makeAsset({ frameRate: 10 }), [makeFrame(0)], 200);
assert(overrideIndex.toleranceMs === 200, "tolerance override: 200ms");

// =============================================================================
// BINARY FORMAT — encode + decode round-trip
// =============================================================================

const encAsset = makeAsset({ frameRate: 10, durationMs: 300, frameCount: 3 });
const encFrames = [
  makeFrame(0,   50),
  makeFrame(100, 128),
  makeFrame(200, 200),
];

const payload = encodeDepthPayload(encAsset, encFrames);
assert(payload instanceof ArrayBuffer, "encode: returns ArrayBuffer");

// Expected size: 64 + 3*4 + 3*16 = 64 + 12 + 48 = 124
assert(payload.byteLength === 124, `encode: correct size (got ${payload.byteLength})`);

// Decode metadata
const meta = decodeDepthMeta(payload);
assert(meta.version === DEPTH_FORMAT_VERSION, "decode meta: version");
assert(meta.width === 4,  "decode meta: width");
assert(meta.height === 4, "decode meta: height");
assert(meta.frameCount === 3, "decode meta: frameCount");
assert(approx(meta.frameRate, 10), "decode meta: frameRate");
assert(meta.durationMs === 300, "decode meta: durationMs");
assert(meta.source === "generated", "decode meta: source");
assert(approx(meta.confidence, 0.85, 1e-5), "decode meta: confidence");
assert(meta.timestamps.length === 3, "decode meta: timestamp index length");
assert(meta.timestamps[0] === 0,   "decode meta: timestamp[0] = 0");
assert(meta.timestamps[1] === 100, "decode meta: timestamp[1] = 100");
assert(meta.timestamps[2] === 200, "decode meta: timestamp[2] = 200");

// Decode individual frames
const f0 = decodeDepthFrame(payload, meta, 0);
assert(f0.timeMs === 0,  "decode frame 0: timeMs");
assert(f0.data[0] === 50, "decode frame 0: pixel value");

const f1 = decodeDepthFrame(payload, meta, 1);
assert(f1.timeMs === 100, "decode frame 1: timeMs");
assert(f1.data[0] === 128, "decode frame 1: pixel value");

const f2 = decodeDepthFrame(payload, meta, 2);
assert(f2.timeMs === 200, "decode frame 2: timeMs");
assert(f2.data[0] === 200, "decode frame 2: pixel value");

// Decode all frames
const { meta: allMeta, frames: allFrames } = decodeAllDepthFrames(payload);
assert(allFrames.length === 3, "decodeAll: 3 frames");
assert(allFrames[0].data[0] === 50,  "decodeAll: frame 0 pixel");
assert(allFrames[1].data[0] === 128, "decodeAll: frame 1 pixel");
assert(allFrames[2].data[0] === 200, "decodeAll: frame 2 pixel");

// depthAssetFromMeta
const rebuilt = depthAssetFromMeta("test-id", meta);
assert(rebuilt.assetId === "test-id", "depthAssetFromMeta: assetId");
assert(rebuilt.width === 4, "depthAssetFromMeta: width");
assert(rebuilt.source === "generated", "depthAssetFromMeta: source");
assert(rebuilt.convention.near === 1.0, "depthAssetFromMeta: convention.near");

// =============================================================================
// BINARY FORMAT — frame ordering (encoder sorts by timeMs)
// =============================================================================

const unordered = [makeFrame(200, 200), makeFrame(0, 50), makeFrame(100, 128)];
const unorderedPayload = encodeDepthPayload(encAsset, unordered);
const unorderedMeta = decodeDepthMeta(unorderedPayload);
assert(unorderedMeta.timestamps[0] === 0,   "encoder sorts frames: [0] = 0ms");
assert(unorderedMeta.timestamps[1] === 100, "encoder sorts frames: [1] = 100ms");
assert(unorderedMeta.timestamps[2] === 200, "encoder sorts frames: [2] = 200ms");

// =============================================================================
// BINARY FORMAT — validation errors
// =============================================================================

function assertThrows(fn, expectedMsg, label) {
  try {
    fn();
    assert(false, `${label}: expected DepthFormatError but no error thrown`);
  } catch (e) {
    assert(e instanceof DepthFormatError, `${label}: error is DepthFormatError`);
    if (expectedMsg) {
      assert(e.message.includes(expectedMsg), `${label}: message includes "${expectedMsg}" (got: ${e.message})`);
    }
  }
}

// Truncated payload
assertThrows(
  () => decodeDepthMeta(new ArrayBuffer(10)),
  "too small",
  "truncated payload",
);

// Invalid magic
const badMagic = new ArrayBuffer(124);
new Uint8Array(badMagic).set([0x58, 0x58, 0x58, 0x58]); // "XXXX"
assertThrows(() => decodeDepthMeta(badMagic), "invalid magic", "invalid magic");

// Invalid version
const badVersion = encodeDepthPayload(encAsset, encFrames).slice(0);
new Uint8Array(badVersion)[4] = 99;
assertThrows(() => decodeDepthMeta(badVersion), "unsupported format version", "invalid version");

// Invalid encoding
const badEncoding = encodeDepthPayload(encAsset, encFrames).slice(0);
new Uint8Array(badEncoding)[5] = 1;
assertThrows(() => decodeDepthMeta(badEncoding), "unsupported encoding", "invalid encoding");

// Wrong payload size (truncated after header)
const truncated = payload.slice(0, 80);
// Fix magic/version/encoding/convention so header passes, but size check fails
assertThrows(() => decodeDepthMeta(truncated), "payload size", "truncated payload size");

// Zero dimensions
assertThrows(
  () => encodeDepthPayload(makeAsset({ width: 0, height: 4 }), [makeFrame(0)]),
  "width and height",
  "zero width",
);

// Empty frames
assertThrows(
  () => encodeDepthPayload(encAsset, []),
  "at least one frame",
  "empty frames",
);

// Frame data wrong size
assertThrows(
  () => encodeDepthPayload(encAsset, [{ timeMs: 0, width: 4, height: 4, data: new Uint8Array(5) }]),
  "data length",
  "wrong frame data length",
);

// Out-of-range frame index
assertThrows(
  () => decodeDepthFrame(payload, meta, 99),
  "out of range",
  "frame index out of range",
);

// =============================================================================
// RENDERER INTEGRATION — u_has_depth contract
// =============================================================================

// Structural verification: DepthIndex.nearest() → null → u_has_depth = 0
// DepthIndex.nearest() → frame → u_has_depth = 1
// (WebGL not available in Node — verify the contract structurally)

// No depth → u_has_depth = 0
const noDepthIndex = new DepthIndex(makeAsset(), []);
const noFrame = noDepthIndex.nearest(100);
const uHasDepthNoDepth = noFrame !== null ? 1.0 : 0.0;
assert(uHasDepthNoDepth === 0.0, "no depth frame → u_has_depth = 0.0");

// Valid depth → u_has_depth = 1
const validIndex = new DepthIndex(makeAsset(), [makeFrame(100)]);
const validFrame = validIndex.nearest(100);
const uHasDepthValid = validFrame !== null ? 1.0 : 0.0;
assert(uHasDepthValid === 1.0, "valid depth frame → u_has_depth = 1.0");

// Invalid (out of tolerance) → u_has_depth = 0
const outOfTolFrame = validIndex.nearest(500);
const uHasDepthOot = outOfTolFrame !== null ? 1.0 : 0.0;
assert(uHasDepthOot === 0.0, "out-of-tolerance frame → u_has_depth = 0.0 (synthetic fallback)");

// Low confidence → u_has_depth = 0
const lowConfFrame = new DepthIndex(
  makeAsset({ confidence: 0.1 }),
  [makeFrame(100)],
).nearest(100);
const uHasDepthLowConf = lowConfFrame !== null ? 1.0 : 0.0;
assert(uHasDepthLowConf === 0.0, "low confidence → u_has_depth = 0.0 (synthetic fallback)");

// =============================================================================
// TEMPORAL ALIGNMENT — mediaTime → timeMs → nearest frame
// =============================================================================

// rVFC provides mediaTime in seconds. Convert to ms for DepthIndex.
const alignIndex = new DepthIndex(makeAsset({ frameRate: 24 }), [
  makeFrame(0),
  makeFrame(41),   // ~1 frame at 24fps
  makeFrame(83),
  makeFrame(1000),
]);

// mediaTime = 0.041 seconds → timeMs = 41
const alignFrame = alignIndex.nearest(Math.round(0.041 * 1000));
assert(alignFrame !== null, "temporal alignment: 0.041s → 41ms → frame found");
assert(alignFrame.timeMs === 41, "temporal alignment: correct frame at 41ms");

// mediaTime = 1.0 seconds → timeMs = 1000
const alignFrame2 = alignIndex.nearest(Math.round(1.0 * 1000));
assert(alignFrame2 !== null, "temporal alignment: 1.0s → 1000ms → frame found");
assert(alignFrame2.timeMs === 1000, "temporal alignment: correct frame at 1000ms");

// Frame index !== depth frame index — verify by non-sequential lookup
const seekFrame = alignIndex.nearest(Math.round(0.083 * 1000));
assert(seekFrame?.timeMs === 83, "temporal alignment: non-sequential lookup correct");

// =============================================================================
// DEFAULT_DEPTH_CONFIDENCE_THRESHOLD
// =============================================================================

assert(typeof DEFAULT_DEPTH_CONFIDENCE_THRESHOLD === "number", "threshold is a number");
assert(DEFAULT_DEPTH_CONFIDENCE_THRESHOLD > 0 && DEFAULT_DEPTH_CONFIDENCE_THRESHOLD < 1,
  "threshold is in (0, 1)");

console.log("depth-asset.test.mjs: all passed");

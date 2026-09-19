/**
 * Mighty Verse — Versioned Depth Binary Format
 *
 * Defines the binary layout for depth assets stored in Supabase Storage (or any CDN).
 * The format supports random frame lookup without loading the entire payload.
 *
 * FORMAT LAYOUT (version 1):
 * ─────────────────────────────────────────────────────────────────────────────
 * HEADER  (fixed 64 bytes)
 *   [0..3]   magic        4 bytes  ASCII "MVDP" (Mighty Verse Depth Payload)
 *   [4]      version      1 byte   format version (currently 1)
 *   [5]      encoding     1 byte   0 = uint8 linear (only supported value)
 *   [6..7]   reserved     2 bytes  zero-padded
 *   [8..11]  width        4 bytes  uint32 LE — frame width in pixels
 *   [12..15] height       4 bytes  uint32 LE — frame height in pixels
 *   [16..19] frameCount   4 bytes  uint32 LE — total number of frames
 *   [20..23] frameRate    4 bytes  float32 LE — depth FPS (0 = single-frame)
 *   [24..27] durationMs   4 bytes  uint32 LE — total duration ms (0 = single-frame)
 *   [28]     convention   1 byte   0 = MV canonical (near=1/far=0/linear/no-gamma)
 *   [29..31] reserved     3 bytes  zero-padded
 *   [32..35] source       4 bytes  ASCII source tag (see SOURCE_TAGS)
 *   [36..39] confidence   4 bytes  float32 LE — asset-level confidence [0,1]
 *   [40..63] reserved    24 bytes  zero-padded (future use)
 *
 * TIMESTAMP INDEX  (frameCount × 4 bytes, immediately after header)
 *   Each entry: uint32 LE — timeMs for frame[i]
 *   Frames are stored in ascending timeMs order.
 *
 * FRAME PAYLOADS  (frameCount × width × height bytes)
 *   Each frame: width × height bytes of uint8 depth data.
 *   0 = far (background). 255 = near (foreground). Mighty Verse convention.
 *   Frames are stored in the same order as the timestamp index.
 *
 * TOTAL SIZE = 64 + (frameCount × 4) + (frameCount × width × height)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * VALIDATION:
 *   - Magic bytes must be "MVDP".
 *   - Version must be 1.
 *   - Encoding must be 0 (uint8 linear).
 *   - Convention must be 0 (MV canonical).
 *   - width, height, frameCount must be > 0.
 *   - Payload must be exactly the expected size.
 *   - Malformed/truncated payloads throw DepthFormatError — never silently corrupt.
 */

import type { DepthAsset, DepthFrame } from "./depth-asset";
import { MIGHTY_VERSE_DEPTH_CONVENTION, type DepthSource } from "./depth-asset";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEPTH_FORMAT_MAGIC = "MVDP";
export const DEPTH_FORMAT_VERSION = 1;
const HEADER_SIZE = 64;
const ENCODING_UINT8_LINEAR = 0;
const CONVENTION_MV_CANONICAL = 0;

/** Maps DepthSource to a 4-byte ASCII tag stored in the header. */
const SOURCE_TAGS: Record<DepthSource, string> = {
  source_provided:  "SRCP",
  generated:        "GENR",
  inferred:         "INFR",
  creator_authored: "AUTH",
  runtime_synthetic:"SYNT",
};

const TAG_TO_SOURCE: Record<string, DepthSource> = Object.fromEntries(
  Object.entries(SOURCE_TAGS).map(([k, v]) => [v, k as DepthSource]),
);

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class DepthFormatError extends Error {
  constructor(message: string) {
    super(`DepthFormatError: ${message}`);
    this.name = "DepthFormatError";
  }
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

/**
 * Encode a set of depth frames into the Mighty Verse versioned binary format.
 *
 * @param asset   The DepthAsset descriptor (must use MIGHTY_VERSE_DEPTH_CONVENTION).
 * @param frames  Frames to encode. Will be sorted by timeMs before encoding.
 * @returns       ArrayBuffer containing the complete depth payload.
 */
export function encodeDepthPayload(asset: DepthAsset, frames: DepthFrame[]): ArrayBuffer {
  if (asset.width <= 0 || asset.height <= 0) {
    throw new DepthFormatError("width and height must be > 0");
  }
  if (frames.length === 0) {
    throw new DepthFormatError("at least one frame is required");
  }

  const sorted = [...frames].sort((a, b) => a.timeMs - b.timeMs);
  const framePixels = asset.width * asset.height;
  const totalSize = HEADER_SIZE + sorted.length * 4 + sorted.length * framePixels;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // --- HEADER ---
  // Magic
  for (let i = 0; i < 4; i++) bytes[i] = DEPTH_FORMAT_MAGIC.charCodeAt(i);
  // Version
  bytes[4] = DEPTH_FORMAT_VERSION;
  // Encoding
  bytes[5] = ENCODING_UINT8_LINEAR;
  // Reserved [6..7] = 0
  // Width, height, frameCount
  view.setUint32(8,  asset.width,       true);
  view.setUint32(12, asset.height,      true);
  view.setUint32(16, sorted.length,     true);
  // frameRate (float32)
  view.setFloat32(20, asset.frameRate ?? 0, true);
  // durationMs
  view.setUint32(24, asset.durationMs ?? 0, true);
  // Convention
  bytes[28] = CONVENTION_MV_CANONICAL;
  // Reserved [29..31] = 0
  // Source tag (4 bytes ASCII)
  const tag = SOURCE_TAGS[asset.source] ?? "GENR";
  for (let i = 0; i < 4; i++) bytes[32 + i] = tag.charCodeAt(i);
  // Confidence (float32)
  view.setFloat32(36, asset.confidence, true);
  // Reserved [40..63] = 0

  // --- TIMESTAMP INDEX ---
  const indexOffset = HEADER_SIZE;
  for (let i = 0; i < sorted.length; i++) {
    view.setUint32(indexOffset + i * 4, sorted[i].timeMs, true);
  }

  // --- FRAME PAYLOADS ---
  const payloadOffset = HEADER_SIZE + sorted.length * 4;
  for (let i = 0; i < sorted.length; i++) {
    const frame = sorted[i];
    if (frame.data.length !== framePixels) {
      throw new DepthFormatError(
        `frame[${i}] data length ${frame.data.length} !== expected ${framePixels} (${asset.width}×${asset.height})`,
      );
    }
    bytes.set(frame.data, payloadOffset + i * framePixels);
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Decoder — metadata only (no frame data loaded)
// ---------------------------------------------------------------------------

export type DepthPayloadMeta = {
  version: number;
  width: number;
  height: number;
  frameCount: number;
  frameRate: number;
  durationMs: number;
  source: DepthSource;
  confidence: number;
  /** Timestamp index — timeMs for each frame, in storage order. */
  timestamps: number[];
};

/**
 * Decode only the header and timestamp index from a depth payload.
 * Does NOT load frame pixel data — supports random access without full load.
 *
 * @throws DepthFormatError on any validation failure.
 */
export function decodeDepthMeta(buffer: ArrayBuffer): DepthPayloadMeta {
  validateHeader(buffer);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const width      = view.getUint32(8,  true);
  const height     = view.getUint32(12, true);
  const frameCount = view.getUint32(16, true);
  const frameRate  = view.getFloat32(20, true);
  const durationMs = view.getUint32(24, true);
  const sourceTag  = String.fromCharCode(bytes[32], bytes[33], bytes[34], bytes[35]);
  const source     = TAG_TO_SOURCE[sourceTag] ?? "generated";
  const confidence = view.getFloat32(36, true);

  const expectedSize = HEADER_SIZE + frameCount * 4 + frameCount * width * height;
  if (buffer.byteLength !== expectedSize) {
    throw new DepthFormatError(
      `payload size ${buffer.byteLength} !== expected ${expectedSize}`,
    );
  }

  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    timestamps.push(view.getUint32(HEADER_SIZE + i * 4, true));
  }

  return { version: DEPTH_FORMAT_VERSION, width, height, frameCount, frameRate, durationMs, source, confidence, timestamps };
}

/**
 * Decode a single frame by index from a depth payload.
 * Supports random access — only the requested frame's pixels are copied.
 *
 * @param buffer  The full depth payload ArrayBuffer.
 * @param meta    Previously decoded metadata (avoids re-parsing the header).
 * @param index   Zero-based frame index.
 * @throws DepthFormatError if index is out of range.
 */
export function decodeDepthFrame(
  buffer: ArrayBuffer,
  meta: DepthPayloadMeta,
  index: number,
): DepthFrame {
  if (index < 0 || index >= meta.frameCount) {
    throw new DepthFormatError(`frame index ${index} out of range [0, ${meta.frameCount - 1}]`);
  }
  const framePixels = meta.width * meta.height;
  const payloadOffset = HEADER_SIZE + meta.frameCount * 4;
  const frameOffset = payloadOffset + index * framePixels;
  const data = new Uint8Array(buffer, frameOffset, framePixels).slice(); // copy — don't hold buffer ref
  return {
    timeMs: meta.timestamps[index],
    width: meta.width,
    height: meta.height,
    data,
  };
}

/**
 * Decode all frames from a depth payload.
 * Use only when the full asset must be loaded into memory (e.g. short clips).
 * For long assets, prefer decodeDepthFrame() with random access.
 */
export function decodeAllDepthFrames(buffer: ArrayBuffer): { meta: DepthPayloadMeta; frames: DepthFrame[] } {
  const meta = decodeDepthMeta(buffer);
  const frames: DepthFrame[] = [];
  for (let i = 0; i < meta.frameCount; i++) {
    frames.push(decodeDepthFrame(buffer, meta, i));
  }
  return { meta, frames };
}

/**
 * Build a DepthAsset descriptor from decoded metadata.
 * The assetId must be supplied by the caller (from the database record).
 */
export function depthAssetFromMeta(assetId: string, meta: DepthPayloadMeta): DepthAsset {
  return {
    assetId,
    source: meta.source,
    confidence: meta.confidence,
    width: meta.width,
    height: meta.height,
    frameRate: meta.frameRate > 0 ? meta.frameRate : undefined,
    convention: MIGHTY_VERSE_DEPTH_CONVENTION,
    formatVersion: meta.version,
    frameCount: meta.frameCount,
    durationMs: meta.durationMs > 0 ? meta.durationMs : undefined,
  };
}

// ---------------------------------------------------------------------------
// Internal validation
// ---------------------------------------------------------------------------

function validateHeader(buffer: ArrayBuffer): void {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new DepthFormatError(`payload too small: ${buffer.byteLength} < ${HEADER_SIZE}`);
  }
  const bytes = new Uint8Array(buffer);

  // Magic
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== DEPTH_FORMAT_MAGIC) {
    throw new DepthFormatError(`invalid magic "${magic}" (expected "${DEPTH_FORMAT_MAGIC}")`);
  }
  // Version
  if (bytes[4] !== DEPTH_FORMAT_VERSION) {
    throw new DepthFormatError(`unsupported format version ${bytes[4]} (expected ${DEPTH_FORMAT_VERSION})`);
  }
  // Encoding
  if (bytes[5] !== ENCODING_UINT8_LINEAR) {
    throw new DepthFormatError(`unsupported encoding ${bytes[5]} (expected ${ENCODING_UINT8_LINEAR} = uint8 linear)`);
  }
  // Convention
  if (bytes[28] !== CONVENTION_MV_CANONICAL) {
    throw new DepthFormatError(`unsupported convention ${bytes[28]} (expected ${CONVENTION_MV_CANONICAL} = MV canonical)`);
  }
  // Dimensions
  const view = new DataView(buffer);
  const width      = view.getUint32(8,  true);
  const height     = view.getUint32(12, true);
  const frameCount = view.getUint32(16, true);
  if (width === 0 || height === 0) {
    throw new DepthFormatError(`invalid dimensions ${width}×${height}`);
  }
  if (frameCount === 0) {
    throw new DepthFormatError("frameCount must be > 0");
  }
}

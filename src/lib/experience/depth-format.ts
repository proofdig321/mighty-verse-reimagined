/**
 * Mighty Verse — Versioned Depth Binary Format
 *
 * Defines the binary layout for depth assets stored in Supabase Storage (or any CDN).
 * The format supports random frame lookup without loading the entire payload.
 *
 * FORMAT LAYOUT (version 1 / version 2):
 * ─────────────────────────────────────────────────────────────────────────────
 * HEADER  (fixed 64 bytes)
 *   [0..3]   magic        4 bytes  ASCII "MVDP" (Mighty Verse Depth Payload)
 *   [4]      version      1 byte   1 = uint8 frames, 2 = uint16 LE frames
 *   [5]      encoding     1 byte   0 = uint8 linear, 1 = uint16 LE linear
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
 * FRAME PAYLOADS  (frameCount × width × height × bytesPerPixel bytes)
 *   v1: 1 byte/pixel uint8.  0 = far, 255 = near.
 *   v2: 2 bytes/pixel uint16 LE.  0 = far, 65535 = near.
 *   Frames are stored in the same order as the timestamp index.
 *
 * TOTAL SIZE (v1) = 64 + (frameCount × 4) + (frameCount × width × height)
 * TOTAL SIZE (v2) = 64 + (frameCount × 4) + (frameCount × width × height × 2)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * VALIDATION:
 *   - Magic bytes must be "MVDP".
 *   - Version must be 1 or 2.
 *   - Encoding must be 0 (uint8) or 1 (uint16 LE).
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
export const DEPTH_FORMAT_VERSION = 2;
const DEPTH_FORMAT_VERSION_MIN = 1;
const HEADER_SIZE = 64;
const ENCODING_UINT8_LINEAR = 0;
const ENCODING_UINT16_LE = 1;
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
  // Detect encoding from first frame's data type.
  const isUint16 = sorted[0].data instanceof Uint16Array;
  const bytesPerPixel = isUint16 ? 2 : 1;
  const encoding = isUint16 ? ENCODING_UINT16_LE : ENCODING_UINT8_LINEAR;
  const version = isUint16 ? 2 : 1;
  const totalSize = HEADER_SIZE + sorted.length * 4 + sorted.length * framePixels * bytesPerPixel;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // --- HEADER ---
  // Magic
  for (let i = 0; i < 4; i++) bytes[i] = DEPTH_FORMAT_MAGIC.charCodeAt(i);
  // Version
  bytes[4] = version;
  // Encoding
  bytes[5] = encoding;
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
    if (isUint16) {
      // Write uint16 LE values into the byte buffer.
      const frameByteOffset = payloadOffset + i * framePixels * 2;
      for (let p = 0; p < framePixels; p++) {
        view.setUint16(frameByteOffset + p * 2, (frame.data as Uint16Array)[p], true);
      }
    } else {
      bytes.set(frame.data as Uint8Array, payloadOffset + i * framePixels);
    }
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

  const encoding = bytes[5];
  const bytesPerPixel = encoding === ENCODING_UINT16_LE ? 2 : 1;
  const expectedSize = HEADER_SIZE + frameCount * 4 + frameCount * width * height * bytesPerPixel;
  if (buffer.byteLength !== expectedSize) {
    throw new DepthFormatError(
      `payload size ${buffer.byteLength} !== expected ${expectedSize}`,
    );
  }

  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    timestamps.push(view.getUint32(HEADER_SIZE + i * 4, true));
  }

  const version = bytes[4];
  return { version, width, height, frameCount, frameRate, durationMs, source, confidence, timestamps };
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
  const isUint16 = meta.version >= 2;
  const bytesPerPixel = isUint16 ? 2 : 1;
  const payloadOffset = HEADER_SIZE + meta.frameCount * 4;
  const frameByteOffset = payloadOffset + index * framePixels * bytesPerPixel;
  let data: Uint8Array | Uint16Array;
  if (isUint16) {
    // Copy uint16 LE values — DataView handles alignment safely.
    const view = new DataView(buffer);
    const arr = new Uint16Array(framePixels);
    for (let p = 0; p < framePixels; p++) {
      arr[p] = view.getUint16(frameByteOffset + p * 2, true);
    }
    data = arr;
  } else {
    data = new Uint8Array(buffer, frameByteOffset, framePixels).slice();
  }
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
  if (bytes[4] < DEPTH_FORMAT_VERSION_MIN || bytes[4] > DEPTH_FORMAT_VERSION) {
    throw new DepthFormatError(`unsupported format version ${bytes[4]} (supported: ${DEPTH_FORMAT_VERSION_MIN}–${DEPTH_FORMAT_VERSION})`);
  }
  // Encoding
  if (bytes[5] !== ENCODING_UINT8_LINEAR && bytes[5] !== ENCODING_UINT16_LE) {
    throw new DepthFormatError(`unsupported encoding ${bytes[5]} (supported: 0=uint8, 1=uint16LE)`);
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

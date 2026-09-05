/**
 * Media metadata layer tests.
 * Run with: node --experimental-vm-modules src/lib/media/__tests__/metadata.test.mjs
 * (or via the npm test script added below)
 *
 * Tests cover:
 *   1. Media class detection
 *   2. Audio metadata extraction (MP3 with embedded ISRC)
 *   3. Audio metadata extraction (no ISRC)
 *   4. Image metadata extraction
 *   5. Unknown format fallback
 *   6. ISRC conflict detection — embedded matches canonical
 *   7. ISRC conflict detection — embedded differs from canonical
 *   8. ISRC conflict detection — embedded present, no canonical
 *   9. ISRC conflict detection — no ISRC anywhere
 *  10. MP3 ID3 embedding round-trip
 *  11. MP3 embedding — no ISRC (eligible realization without assigned ISRC)
 *  12. Image XMP embedding round-trip
 *  13. Canonical metadata hash — deterministic
 *  14. Canonical metadata hash — changes when ISRC changes
 *  15. Sidecar staleness detection
 *  16. Idempotency — embedding twice does not corrupt
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pass(name) { console.log("  \x1b[32m✓\x1b[0m", name); }
function fail(name, err) { console.error("  \x1b[31m✗\x1b[0m", name, "\n   ", err.message); process.exitCode = 1; }

async function test(name, fn) {
  try { await fn(); pass(name); }
  catch (err) { fail(name, err); }
}

// ─── Import modules ───────────────────────────────────────────────────────────

const { detectMediaClass, extractFileMetadata, detectIsrcConflict } = await import("../metadata-extract.js");
const { hashCanonicalMetadata } = await import("../metadata-build.js");
const { embedMp3Metadata, embedImageMetadata } = await import("../metadata-embed.js");
const NodeID3 = (await import("node-id3")).default;
const mm = await import("music-metadata");
const sharp = (await import("sharp")).default;

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal valid MP3 buffer with ID3v2 header (44 bytes). */
function makeMinimalMp3(existingIsrc) {
  // Write a real ID3v2 tag using node-id3 on a tiny buffer
  const tags = { title: "Test Track", artist: "Test Artist" };
  if (existingIsrc) tags.TSRC = existingIsrc;
  const id3 = NodeID3.create(tags);
  // Append a minimal MP3 frame (silence)
  const frame = Buffer.alloc(417, 0); // 417 bytes = one MP3 frame at 128kbps
  frame[0] = 0xFF; frame[1] = 0xFB; frame[2] = 0x90; frame[3] = 0x00;
  return Buffer.concat([id3, frame]);
}

/** Minimal 1x1 JPEG buffer. */
async function makeMinimalJpeg() {
  return sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 128, g: 128, b: 128 } } })
    .jpeg().toBuffer();
}

/** Canonical metadata fixture. */
function makeCanonicalMeta(overrides = {}) {
  return {
    mediaAssetId: "test-asset-id",
    mediaRealizationId: "test-realization-id",
    masterId: "test-master-id",
    title: "Golden Shovel — Powerhouse",
    creator: "Golden Shovel",
    description: "A test scene",
    rightsHolder: "participant-id-123",
    rightsHolderLabel: "Golden Shovel",
    rightsBasis: "owned",
    copyrightYear: 2026,
    realizationType: "music-video",
    versionLabel: null,
    isrc: null,
    isrcStatus: null,
    isrcRegistrantName: null,
    metadataGeneratedAt: new Date().toISOString(),
    metadataVersion: 1,
    metadataSchema: "mighty-verse-media-metadata",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\nMedia Metadata Layer Tests\n");

// 1. Media class detection
await test("detectMediaClass: MP3 by MIME", () => {
  assert.equal(detectMediaClass("audio/mpeg"), "audio-mp3");
});
await test("detectMediaClass: MP3 by extension", () => {
  assert.equal(detectMediaClass(null, "track.mp3"), "audio-mp3");
});
await test("detectMediaClass: FLAC is audio-other", () => {
  assert.equal(detectMediaClass("audio/flac", "track.flac"), "audio-other");
});
await test("detectMediaClass: MP4 is video", () => {
  assert.equal(detectMediaClass("video/mp4", "clip.mp4"), "video");
});
await test("detectMediaClass: JPEG is image-raster", () => {
  assert.equal(detectMediaClass("image/jpeg", "photo.jpg"), "image-raster");
});
await test("detectMediaClass: SVG is image-other", () => {
  assert.equal(detectMediaClass("image/svg+xml", "icon.svg"), "image-other");
});
await test("detectMediaClass: unknown returns unknown", () => {
  assert.equal(detectMediaClass("application/octet-stream"), "unknown");
});

// 2. Audio extraction — MP3 with embedded ISRC
await test("extractFileMetadata: MP3 with embedded ISRC", async () => {
  const buf = makeMinimalMp3("GBAYE0601498");
  const result = await extractFileMetadata(buf, "audio/mpeg", "track.mp3");
  assert.equal(result.mediaClass, "audio-mp3");
  assert.equal(result.title, "Test Track");
  assert.equal(result.artist, "Test Artist");
  assert.equal(result.embeddedIsrc, "GBAYE0601498");
});

// 3. Audio extraction — MP3 without ISRC
await test("extractFileMetadata: MP3 without ISRC", async () => {
  const buf = makeMinimalMp3(null);
  const result = await extractFileMetadata(buf, "audio/mpeg", "track.mp3");
  assert.equal(result.mediaClass, "audio-mp3");
  assert.equal(result.embeddedIsrc, null);
});

// 4. Image extraction
await test("extractFileMetadata: JPEG image", async () => {
  const buf = await makeMinimalJpeg();
  const result = await extractFileMetadata(buf, "image/jpeg", "photo.jpg");
  assert.equal(result.mediaClass, "image-raster");
  assert.equal(result.embeddedIsrc, null); // images don't carry ISRC
});

// 5. Unknown format fallback
await test("extractFileMetadata: unknown format returns base", async () => {
  const buf = Buffer.from("not a real media file");
  const result = await extractFileMetadata(buf, "application/octet-stream");
  assert.equal(result.mediaClass, "unknown");
  assert.equal(result.embeddedIsrc, null);
});

// 6. ISRC conflict — embedded matches canonical
await test("detectIsrcConflict: matching ISRCs — no conflict", () => {
  const extracted = { embeddedIsrc: "GBAYE0601498" };
  const result = detectIsrcConflict(extracted, "GBAYE0601498");
  assert.equal(result.conflict, false);
});

// 7. ISRC conflict — embedded differs from canonical
await test("detectIsrcConflict: mismatched ISRCs — conflict", () => {
  const extracted = { embeddedIsrc: "GBAYE0601498" };
  const result = detectIsrcConflict(extracted, "ZAXX12600001");
  assert.equal(result.conflict, true);
  assert.ok(result.description.includes("conflict"));
});

// 8. ISRC conflict — embedded present, no canonical
await test("detectIsrcConflict: embedded only — no conflict, needs review", () => {
  const extracted = { embeddedIsrc: "GBAYE0601498" };
  const result = detectIsrcConflict(extracted, null);
  assert.equal(result.conflict, false);
  assert.ok(result.description.includes("operator should review"));
});

// 9. ISRC conflict — no ISRC anywhere
await test("detectIsrcConflict: no ISRC anywhere — no conflict", () => {
  const extracted = { embeddedIsrc: null };
  const result = detectIsrcConflict(extracted, null);
  assert.equal(result.conflict, false);
});

// 10. MP3 ID3 embedding round-trip
await test("embedMp3Metadata: round-trip with ISRC", async () => {
  const buf = makeMinimalMp3(null);
  const meta = makeCanonicalMeta({ isrc: "ZAXX12600001" });
  const embedded = await embedMp3Metadata(buf, meta);
  assert.ok(Buffer.isBuffer(embedded));
  assert.ok(embedded.length >= buf.length);
  // Read back
  const tags = NodeID3.read(embedded);
  assert.equal(tags.title, "Golden Shovel — Powerhouse");
  assert.equal(tags.artist, "Golden Shovel");
  assert.equal(tags.ISRC, "ZAXX12600001");
});

// 11. MP3 embedding — no ISRC (eligible realization without assigned ISRC)
await test("embedMp3Metadata: no ISRC — TSRC not written", async () => {
  const buf = makeMinimalMp3(null);
  const meta = makeCanonicalMeta({ isrc: null }); // no ISRC yet
  const embedded = await embedMp3Metadata(buf, meta);
  const tags = NodeID3.read(embedded);
  // TSRC should not be present (no fabricated ISRC)
  // node-id3 reads TSRC frame back as ISRC key
  assert.ok(!tags.ISRC || tags.ISRC === undefined);
});

// 12. Image XMP embedding round-trip
await test("embedImageMetadata: XMP round-trip", async () => {
  const buf = await makeMinimalJpeg();
  const meta = makeCanonicalMeta({ isrc: null });
  const embedded = await embedImageMetadata(buf, meta, "jpeg");
  assert.ok(Buffer.isBuffer(embedded));
  assert.ok(embedded.length > 0);
  // Read back XMP
  const readMeta = await sharp(embedded).metadata();
  assert.ok(readMeta.xmp, "XMP should be present");
  const xmpStr = readMeta.xmp.toString("utf8");
  assert.ok(xmpStr.includes("Golden Shovel"), "XMP should contain title");
  assert.ok(xmpStr.includes("mighty-verse:asset:test-asset-id"), "XMP should contain asset ID");
});

// 13. Canonical metadata hash — deterministic
await test("hashCanonicalMetadata: same input produces same hash", () => {
  const meta = makeCanonicalMeta();
  const h1 = hashCanonicalMetadata(meta);
  const h2 = hashCanonicalMetadata(meta);
  assert.equal(h1, h2);
});

// 14. Canonical metadata hash — changes when ISRC changes
await test("hashCanonicalMetadata: different ISRC produces different hash", () => {
  const meta1 = makeCanonicalMeta({ isrc: null });
  const meta2 = makeCanonicalMeta({ isrc: "ZAXX12600001" });
  const h1 = hashCanonicalMetadata(meta1);
  const h2 = hashCanonicalMetadata(meta2);
  assert.notEqual(h1, h2);
});

// 15. Sidecar staleness detection
await test("hashCanonicalMetadata: timestamp excluded from hash", () => {
  const meta1 = makeCanonicalMeta({ metadataGeneratedAt: "2026-01-01T00:00:00.000Z" });
  const meta2 = makeCanonicalMeta({ metadataGeneratedAt: "2026-12-31T23:59:59.999Z" });
  const h1 = hashCanonicalMetadata(meta1);
  const h2 = hashCanonicalMetadata(meta2);
  assert.equal(h1, h2, "Hash should be identical regardless of generation timestamp");
});

// 16. Idempotency — embedding twice does not corrupt
await test("embedMp3Metadata: idempotent — embedding twice preserves ISRC", async () => {
  const buf = makeMinimalMp3(null);
  const meta = makeCanonicalMeta({ isrc: "ZAXX12600001" });
  const pass1 = await embedMp3Metadata(buf, meta);
  const pass2 = await embedMp3Metadata(pass1, meta);
  const tags = NodeID3.read(pass2);
  assert.equal(tags.ISRC, "ZAXX12600001");
  assert.equal(tags.title, "Golden Shovel — Powerhouse");
});

console.log("\nDone.\n");

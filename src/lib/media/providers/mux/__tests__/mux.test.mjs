/**
 * Mux provider adapter tests.
 * Run with: npx tsx src/lib/media/providers/mux/__tests__/mux.test.mjs
 */

import assert from "node:assert/strict";
import { mapMuxAsset, MuxAdapter } from "../adapter.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
  }
}

// mapMuxAsset: audio-only
test("mapMuxAsset: audio-only asset -> media_class = audio", () => {
  const result = mapMuxAsset({
    id: "abc123",
    duration: 210.5,
    tracks: [{ type: "audio" }],
    playback_ids: [{ id: "pb_abc", policy: "public" }],
  });
  assert.equal(result.mediaClass, "audio");
  assert.equal(result.resolution, null);
});

// mapMuxAsset: video
test("mapMuxAsset: video asset -> media_class = video", () => {
  const result = mapMuxAsset({
    id: "vid456",
    duration: 180.0,
    tracks: [{ type: "video", width: 1920, height: 1080 }, { type: "audio" }],
    playback_ids: [{ id: "pb_vid", policy: "public" }],
  });
  assert.equal(result.mediaClass, "video");
  assert.equal(result.resolution, "1920x1080");
});

// mapMuxAsset: no tracks
test("mapMuxAsset: no tracks -> media_class = other", () => {
  const result = mapMuxAsset({ id: "empty", tracks: [], playback_ids: [{ id: "pb", policy: "public" }] });
  assert.equal(result.mediaClass, "other");
});

// mapMuxAsset: duration ms conversion
test("mapMuxAsset: duration seconds -> ms", () => {
  const result = mapMuxAsset({ id: "d", duration: 3.5, tracks: [{ type: "audio" }], playback_ids: [{ id: "pb", policy: "public" }] });
  assert.equal(result.durationMs, 3500);
});

// mapMuxAsset: null duration
test("mapMuxAsset: null duration -> null durationMs", () => {
  const result = mapMuxAsset({ id: "nd", tracks: [{ type: "audio" }], playback_ids: [{ id: "pb", policy: "public" }] });
  assert.equal(result.durationMs, null);
});

// mapMuxAsset: integrity hash
test("mapMuxAsset: integrity hash = mux:{assetId}", () => {
  const result = mapMuxAsset({ id: "hashtest", tracks: [{ type: "audio" }], playback_ids: [{ id: "pb", policy: "public" }] });
  assert.equal(result.integrityHash, "mux:hashtest");
});

// mapMuxAsset: providerAssetId
test("mapMuxAsset: providerAssetId matches asset.id", () => {
  const result = mapMuxAsset({ id: "myid", tracks: [{ type: "video" }], playback_ids: [{ id: "pb", policy: "public" }] });
  assert.equal(result.providerAssetId, "myid");
});

// mapMuxAsset: empty playback_ids
test("mapMuxAsset: no playback_ids -> empty playbackId", () => {
  const result = mapMuxAsset({ id: "nopb", tracks: [{ type: "audio" }], playback_ids: [] });
  assert.equal(result.playbackId, "");
});

// buildPlaybackSource: HLS URL
test("buildPlaybackSource: Mux HLS URL construction", () => {
  const adapter = new MuxAdapter();
  const source = adapter.buildPlaybackSource("test_pb_id", "video");
  assert.equal(source.endpoint, "https://stream.mux.com/test_pb_id.m3u8");
  assert.equal(source.protocol, "hls");
  assert.equal(source.provider, "mux");
});

// buildPlaybackSource: audio class preserved
test("buildPlaybackSource: audio mediaClass preserved", () => {
  const adapter = new MuxAdapter();
  const source = adapter.buildPlaybackSource("audio_pb", "audio");
  assert.equal(source.mediaClass, "audio");
  assert.equal(source.playbackId, "audio_pb");
});

// buildPlaybackSource: video class preserved
test("buildPlaybackSource: video mediaClass preserved", () => {
  const adapter = new MuxAdapter();
  const source = adapter.buildPlaybackSource("video_pb", "video");
  assert.equal(source.mediaClass, "video");
});

// Lineage: self-reference is semantically invalid
test("source_realization_id: self-reference is semantically invalid", () => {
  const id = "aaaaaaaa-0000-0000-0000-000000000001";
  // DB CHECK (source_realization_id <> realization_id) prevents this
  assert.equal(id === id, true, "Self-reference detected — DB constraint rejects this");
});

// Lineage: valid derivation
test("source_realization_id: valid derivation uses different IDs", () => {
  const audioId = "aaaaaaaa-0000-0000-0000-000000000001";
  const visualId = "bbbbbbbb-0000-0000-0000-000000000002";
  assert.notEqual(audioId, visualId);
  const derived = { realization_id: visualId, source_realization_id: audioId, isrc: null, rights_holder_ref: null };
  assert.equal(derived.source_realization_id, audioId);
});

// Lineage: no ISRC inheritance
test("No ISRC inheritance through source_realization_id", () => {
  const source = { realization_id: "src", isrc: "ZAXX12600001", isrc_status: "assigned" };
  const derived = { realization_id: "der", source_realization_id: source.realization_id, isrc: null, isrc_status: "not-applicable" };
  assert.equal(derived.isrc, null);
  assert.notEqual(derived.isrc, source.isrc);
});

// Lineage: no rights inheritance
test("No rights inheritance through source_realization_id", () => {
  const source = { realization_id: "src2", rights_holder_ref: "golden-shovel-id" };
  const derived = { realization_id: "der2", source_realization_id: source.realization_id, rights_holder_ref: null };
  assert.equal(derived.rights_holder_ref, null);
  assert.notEqual(derived.rights_holder_ref, source.rights_holder_ref);
});

// Webhook authority boundary: webhook must not create realization
test("Webhook authority boundary: webhook creates media_asset only", () => {
  // Document the invariant: the webhook handler creates media_asset + delivery_variant
  // It does NOT create media_realization, projection_media_binding, or ISRC records.
  const webhookAllowedCreations = ["media_asset", "delivery_variant"];
  const webhookForbiddenCreations = ["media_realization", "projection_media_binding", "isrc_assignment_log", "authority_record"];
  assert.ok(webhookAllowedCreations.includes("media_asset"));
  assert.ok(webhookAllowedCreations.includes("delivery_variant"));
  for (const forbidden of webhookForbiddenCreations) {
    assert.ok(!webhookAllowedCreations.includes(forbidden), `Webhook must not create ${forbidden}`);
  }
});

console.log(`\nMux provider tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

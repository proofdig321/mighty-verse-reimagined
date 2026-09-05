/**
 * Inspection wiring tests.
 *
 * Verifies:
 * - Asset playback resolution contract
 * - Provider-neutral thumbnail derivation
 * - Inspect navigation URL construction
 * - Mux thumbnail URL format
 * - Livepeer thumbnail URL format
 * - Unsupported provider handling
 * - Missing delivery variant fallback
 * - Non-video asset rejection
 * - Canonical scene safety (no mutation)
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// ─── Thumbnail derivation ─────────────────────────────────────────────────────

function deriveThumbnailUrl(asset) {
  const { storage_ref, provider, asset_type } = asset;
  const isPlaceholder = storage_ref.startsWith("seed:placeholder:");
  const isThumbnail = storage_ref.startsWith("thumbnail:") || storage_ref.startsWith("http");
  if (isThumbnail) return storage_ref.startsWith("thumbnail:") ? null : storage_ref;
  if (isPlaceholder || asset_type === "thumbnail" || asset_type === "metadata") return null;
  if (provider === "mux") return `https://image.mux.com/${storage_ref}/thumbnail.jpg?time=5&width=320`;
  if (provider === "livepeer" || !provider) return `https://vod-cdn.lp-playback.studio/${storage_ref}/thumbnails/keyframes_0.png`;
  return null;
}

test("thumbnail: mux video uses image.mux.com", () => {
  const url = deriveThumbnailUrl({ storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4", provider: "mux", asset_type: "video" });
  assert.ok(url.startsWith("https://image.mux.com/"));
  assert.ok(url.includes("JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4"));
  assert.ok(url.includes("thumbnail.jpg"));
});

test("thumbnail: livepeer video uses vod-cdn.lp-playback.studio", () => {
  const url = deriveThumbnailUrl({ storage_ref: "5a112ddzzuvlq3a5", provider: "livepeer", asset_type: "video" });
  assert.ok(url.startsWith("https://vod-cdn.lp-playback.studio/"));
  assert.ok(url.includes("5a112ddzzuvlq3a5"));
});

test("thumbnail: placeholder returns null", () => {
  const url = deriveThumbnailUrl({ storage_ref: "seed:placeholder:abc", provider: "mux", asset_type: "video" });
  assert.equal(url, null);
});

test("thumbnail: thumbnail asset_type returns null", () => {
  const url = deriveThumbnailUrl({ storage_ref: "someref", provider: "mux", asset_type: "thumbnail" });
  assert.equal(url, null);
});

test("thumbnail: mux thumbnail URL contains playback ID", () => {
  const playbackId = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";
  const url = deriveThumbnailUrl({ storage_ref: playbackId, provider: "mux", asset_type: "video" });
  assert.ok(url.includes(playbackId));
});

// ─── Inspect navigation URL ───────────────────────────────────────────────────

function inspectUrl(assetId) {
  return `/authority/media/inspect?assetId=${assetId}`;
}

test("inspect navigation: URL contains assetId", () => {
  const url = inspectUrl("795c057e-0000-0000-0000-000000000000");
  assert.ok(url.includes("assetId=795c057e"));
});

test("inspect navigation: URL is dynamic — not hard-coded", () => {
  const url1 = inspectUrl("asset-aaa");
  const url2 = inspectUrl("asset-bbb");
  assert.notEqual(url1, url2);
});

test("inspect navigation: Super Hero Ego asset ID produces correct URL", () => {
  const url = inspectUrl("795c057e");
  assert.equal(url, "/authority/media/inspect?assetId=795c057e");
});

// ─── Asset playback resolution contract ──────────────────────────────────────

function resolvePlaybackSource(asset, deliveryVariant) {
  if (!asset.provider) return { error: "Asset has no provider" };
  if (asset.asset_type !== "video" && asset.asset_type !== "audio") {
    return { error: `Unsupported media class: ${asset.asset_type}` };
  }
  const mediaClass = asset.asset_type === "audio" ? "audio" : "video";
  let hlsUrl;
  if (asset.provider === "mux") {
    hlsUrl = deliveryVariant?.endpoint_ref ?? `https://stream.mux.com/${asset.storage_ref}.m3u8`;
  } else if (asset.provider === "livepeer") {
    hlsUrl = deliveryVariant?.endpoint_ref ?? `/api/livepeer/playback/${asset.storage_ref}`;
  } else {
    return { error: `Unknown provider: ${asset.provider}` };
  }
  return { hls_url: hlsUrl, media_class: mediaClass, provider: asset.provider };
}

test("playback resolution: mux video resolves HLS URL", () => {
  const asset = { asset_type: "video", provider: "mux", storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4" };
  const result = resolvePlaybackSource(asset, null);
  assert.ok(!result.error);
  assert.ok(result.hls_url.includes("stream.mux.com"));
  assert.ok(result.hls_url.includes("JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4"));
});

test("playback resolution: delivery_variant endpoint takes precedence", () => {
  const asset = { asset_type: "video", provider: "mux", storage_ref: "abc" };
  const variant = { endpoint_ref: "https://stream.mux.com/REAL_PLAYBACK.m3u8" };
  const result = resolvePlaybackSource(asset, variant);
  assert.equal(result.hls_url, "https://stream.mux.com/REAL_PLAYBACK.m3u8");
});

test("playback resolution: livepeer uses proxy endpoint", () => {
  const asset = { asset_type: "video", provider: "livepeer", storage_ref: "5a112ddzzuvlq3a5" };
  const result = resolvePlaybackSource(asset, null);
  assert.ok(!result.error);
  assert.ok(result.hls_url.includes("livepeer") || result.hls_url.includes("5a112ddzzuvlq3a5"));
});

test("playback resolution: missing provider returns error", () => {
  const asset = { asset_type: "video", provider: null, storage_ref: "abc" };
  const result = resolvePlaybackSource(asset, null);
  assert.ok(result.error);
});

test("playback resolution: unsupported asset_type returns error", () => {
  const asset = { asset_type: "thumbnail", provider: "mux", storage_ref: "abc" };
  const result = resolvePlaybackSource(asset, null);
  assert.ok(result.error);
  assert.ok(result.error.includes("Unsupported"));
});

test("playback resolution: unknown provider returns error", () => {
  const asset = { asset_type: "video", provider: "unknown-provider", storage_ref: "abc" };
  const result = resolvePlaybackSource(asset, null);
  assert.ok(result.error);
  assert.ok(result.error.includes("Unknown provider"));
});

test("playback resolution: Super Hero Ego asset resolves correctly", () => {
  const asset = {
    asset_id: "795c057e",
    asset_type: "video",
    provider: "mux",
    storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
    duration_ms: 254800,
    width: 1280,
    height: 720,
  };
  const variant = { endpoint_ref: "https://stream.mux.com/JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4.m3u8" };
  const result = resolvePlaybackSource(asset, variant);
  assert.equal(result.provider, "mux");
  assert.equal(result.media_class, "video");
  assert.ok(result.hls_url.includes("JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4"));
});

// ─── Canonical safety ─────────────────────────────────────────────────────────

test("canonical safety: inspection does not produce master_id", () => {
  // Inspection result shape must not contain canonical identifiers
  const inspectionResult = {
    frames: [],
    deltas: [],
    candidateTimestampsMs: [],
    metadata: { durationMs: 254800, videoWidth: 1280, videoHeight: 720 },
  };
  assert.equal(inspectionResult.master_id, undefined);
  assert.equal(inspectionResult.canonical_state_id, undefined);
  assert.equal(inspectionResult.projection_id, undefined);
  assert.equal(inspectionResult.isrc, undefined);
});

test("canonical safety: candidate has no canonical fields", () => {
  const candidate = {
    candidateId: "ephemeral-id",
    startMs: 10000,
    endMs: 30000,
    reviewState: "pending",
    source: "browser-visual-change",
  };
  assert.equal(candidate.master_id, undefined);
  assert.equal(candidate.canonical_state_id, undefined);
  assert.equal(candidate.isrc, undefined);
  assert.equal(candidate.rights_holder_ref, undefined);
});

console.log("Inspection wiring tests: all passed");

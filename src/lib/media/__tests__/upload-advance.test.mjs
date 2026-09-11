import { decideAdvanceUploadSession } from "../upload-advance-decision";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const created = { phase: "created", provider_asset_id: "pending", asset_id: null };

const fatherRaymond = decideAdvanceUploadSession({
  session: created,
  upload: { status: "asset_created", assetId: "mux-asset-ready" },
  asset: { status: "ready", playbackId: "pb_ready", providerAssetId: "mux-asset-ready" },
});
assert(fatherRaymond.action === "ingest", "Father Raymond ready Mux asset must ingest without webhook");
assert(fatherRaymond.action === "ingest" && fatherRaymond.providerAssetId === "mux-asset-ready", "ingest uses Mux asset id");

const waitingUpload = decideAdvanceUploadSession({
  session: created,
  upload: { status: "waiting", assetId: null },
  asset: null,
});
assert(waitingUpload.action === "wait" && waitingUpload.phase === "uploading", "waiting Mux upload stays uploading");

const preparing = decideAdvanceUploadSession({
  session: { phase: "uploading", provider_asset_id: "pending", asset_id: null },
  upload: { status: "asset_created", assetId: "mux-preparing" },
  asset: { status: "preparing", playbackId: null, providerAssetId: "mux-preparing" },
});
assert(preparing.action === "wait" && preparing.phase === "processing", "preparing Mux asset is processing, not failed");

const readyNoPlayback = decideAdvanceUploadSession({
  session: { phase: "processing", provider_asset_id: "mux-a", asset_id: null },
  upload: { status: "asset_created", assetId: "mux-a" },
  asset: { status: "ready", playbackId: null, providerAssetId: "mux-a" },
});
assert(readyNoPlayback.action === "wait", "ready without playback id still waits");

const erroredUpload = decideAdvanceUploadSession({
  session: created,
  upload: { status: "errored", assetId: null },
  asset: null,
});
assert(erroredUpload.action === "fail", "Mux upload errored is provider failure");

const erroredAsset = decideAdvanceUploadSession({
  session: { phase: "processing", provider_asset_id: "mux-e", asset_id: null },
  upload: { status: "asset_created", assetId: "mux-e" },
  asset: { status: "errored", playbackId: null, providerAssetId: "mux-e" },
});
assert(erroredAsset.action === "fail", "Mux asset errored is provider failure");

const already = decideAdvanceUploadSession({
  session: { phase: "ingested", provider_asset_id: "mux-a", asset_id: "mv-asset" },
  upload: { status: "asset_created", assetId: "mux-a" },
  asset: { status: "ready", playbackId: "pb", providerAssetId: "mux-a" },
});
assert(already.action === "noop", "already ingested sessions are not re-ingested");

const recoverFailed = decideAdvanceUploadSession({
  session: { phase: "failed", provider_asset_id: "pending", asset_id: null },
  upload: { status: "asset_created", assetId: "mux-ready" },
  asset: { status: "ready", playbackId: "pb", providerAssetId: "mux-ready" },
});
assert(recoverFailed.action === "ingest", "a ready Mux asset recovers a session previously marked failed");

const youtubePull = decideAdvanceUploadSession({
  session: { phase: "processing", provider_asset_id: "mux-yt", asset_id: null, provider_upload_id: null },
  upload: null,
  asset: { status: "preparing", playbackId: null, providerAssetId: "mux-yt" },
});
assert(youtubePull.action === "wait" && youtubePull.phase === "processing", "YouTube Mux pull waits without a direct-upload id");

const youtubeReady = decideAdvanceUploadSession({
  session: { phase: "processing", provider_asset_id: "mux-yt", asset_id: null, provider_upload_id: null },
  upload: null,
  asset: { status: "ready", playbackId: "pb_yt", providerAssetId: "mux-yt" },
});
assert(youtubeReady.action === "ingest", "ready Mux asset from a URL pull ingests");

const unknown = decideAdvanceUploadSession({
  session: created,
  upload: null,
  asset: null,
});
assert(unknown.action === "wait" && unknown.phase === "uploading", "missing Mux data waits, it does not fail");

console.log("upload-advance.test.mjs: ok");

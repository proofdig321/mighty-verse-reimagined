import {
  decideDiscardMedia,
  isDiscardedStorageRef,
  isProtectedMediaAsset,
  markDiscardedStorageRef,
  mediaHasLiveCanonicalBinding,
  mediaIsDeletable,
} from "../discard-asset";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "795c057e-2967-4e93-8f5e-06297c674cb0";
const FR = "5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c";
const ORPHAN = "bda79051-6bc9-497f-b0aa-12d95130290c";

assert(isProtectedMediaAsset(SHE) === true, "Super Hero Ego Mux asset is protected");
assert(isProtectedMediaAsset(FR) === true, "Father Raymond Mux asset is protected");
assert(isProtectedMediaAsset(ORPHAN) === false, "unassociated Livepeer asset is not protected");

const she = decideDiscardMedia({ assetId: SHE, liveCanonicalBinding: true });
assert(she.ok === false && she.code === "protected_media", "Super Hero Ego media cannot be deleted");

const fr = decideDiscardMedia({ assetId: FR, liveCanonicalBinding: false });
assert(fr.ok === false && fr.code === "protected_media", "Father Raymond media cannot be deleted even if unbound");

const live = decideDiscardMedia({ assetId: ORPHAN, liveCanonicalBinding: true });
assert(live.ok === false && live.code === "live_binding", "media bound to live work cannot be deleted");

const orphan = decideDiscardMedia({ assetId: ORPHAN, liveCanonicalBinding: false, storageRef: "playback-id" });
assert(orphan.ok === true && orphan.action === "discard", "unassociated orphan media can be deleted");
assert(mediaIsDeletable({ assetId: ORPHAN, liveCanonicalBinding: false }) === true, "deletable helper matches");

const missing = decideDiscardMedia({ assetId: null });
assert(missing.ok === false && missing.code === "invalid_asset", "discard without an asset is rejected");

const discardedRef = markDiscardedStorageRef("abc123");
assert(discardedRef === "operator:discarded:abc123", "discard prefixes storage_ref");
assert(isDiscardedStorageRef(discardedRef) === true, "prefixed storage_ref is discarded");
assert(markDiscardedStorageRef(discardedRef) === discardedRef, "prefix is idempotent");

const already = decideDiscardMedia({
  assetId: ORPHAN,
  storageRef: discardedRef,
  liveCanonicalBinding: false,
});
assert(already.ok === false && already.code === "already_discarded", "already discarded media is refused");

assert(
  mediaHasLiveCanonicalBinding({
    boundUniverses: [{ title: "Super Hero Ego", occupancy: "curated", protected: true }],
  }) === true,
  "SHE binding is live",
);
assert(
  mediaHasLiveCanonicalBinding({
    boundUniverses: [{ title: "Father Raymond - Golden Shovel feat Reverb 360", occupancy: "in_progress" }],
  }) === true,
  "titled in-progress binding is live",
);
assert(
  mediaHasLiveCanonicalBinding({
    boundUniverses: [{ title: null, occupancy: "orphan" }],
  }) === false,
  "untitled orphan binding is not live canonical work",
);
assert(
  mediaHasLiveCanonicalBinding({
    boundUniverses: [{ title: null, occupancy: "curated" }],
  }) === false,
  "untitled playable shell is still an operator orphan for delete",
);
assert(mediaHasLiveCanonicalBinding({ boundUniverses: [] }) === false, "unbound media is not live");

console.log("discard-asset.test.mjs: ok");

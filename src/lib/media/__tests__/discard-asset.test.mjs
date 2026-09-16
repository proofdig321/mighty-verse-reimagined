import {
  decideDiscardMedia,
  decideDiscardIntake,
  isAwaitingUploadIntake,
  isDiscardedStorageRef,
  isProtectedMediaAsset,
  intakeIsDeletable,
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

const unlinked = decideDiscardIntake({ intakeId: "intake-orphan", assetId: null, searchStatus: "pending" });
assert(unlinked.ok === true && unlinked.action === "discard", "unlinked awaiting intake can be deleted");
assert(intakeIsDeletable({ intakeId: "intake-orphan", assetId: null, searchStatus: "pending" }) === true, "intake deletable helper matches");

const excluded = decideDiscardIntake({ intakeId: "intake-orphan", searchStatus: "excluded" });
assert(excluded.ok === false && excluded.code === "already_discarded", "excluded intake is already discarded");

const linked = decideDiscardIntake({ intakeId: "intake-linked", assetId: ORPHAN, searchStatus: "pending" });
assert(linked.ok === false && linked.code === "linked_media", "linked intake is deleted via media, not intake");

const sheIntake = decideDiscardIntake({ intakeId: "intake-she", assetId: SHE, searchStatus: "pending" });
assert(sheIntake.ok === false && sheIntake.code === "protected_media", "Super Hero Ego intake cannot be discarded");

const missingIntake = decideDiscardIntake({ intakeId: null });
assert(missingIntake.ok === false && missingIntake.code === "invalid_intake", "discard without an intake is rejected");

assert(isAwaitingUploadIntake({ assetId: null, searchStatus: "pending" }) === true, "unlinked pending intake awaits upload");
assert(isAwaitingUploadIntake({ assetId: ORPHAN, searchStatus: "pending" }) === false, "linked intake is not awaiting upload");
assert(isAwaitingUploadIntake({ assetId: null, searchStatus: "excluded" }) === false, "excluded intake is hidden from awaiting upload");

console.log("discard-asset.test.mjs: ok");

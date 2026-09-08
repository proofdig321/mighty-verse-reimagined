import { decideInspectionPersist, isInspectableAssetType } from "../inspect-persist";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNBOUND = "bda79051-6bc9-497f-b0aa-12d95130290c";
const MUX = "795c057e-2967-4e93-8f5e-06297c674cb0";
const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";

const evidence = {
  metadata: { durationMs: 12000, hasVideo: true },
  frames: [{ timeMs: 1000 }],
  deltas: [{ fromMs: 1000, toMs: 2000, changeScore: 0.2 }],
  candidateTimestampsMs: [1000],
};

const unbound = decideInspectionPersist({
  asset_id: UNBOUND,
  ...evidence,
});
assert(unbound.ok && unbound.action === "persist_source_inspection", "unbound media can persist inspection");
assert(unbound.asset_id === UNBOUND, "session is anchored to the media asset");
assert(unbound.master_id === null && unbound.scope === "source_media", "no canonical master is required");
assert(
  unbound.creates_universe === false &&
    unbound.creates_mural === false &&
    unbound.creates_scene === false &&
    unbound.creates_creative_moment === false &&
    unbound.creates_projection === false &&
    unbound.creates_binding === false &&
    unbound.creates_realization === false &&
    unbound.creates_canonical === false,
  "persist does not create canonical objects",
);

const omittedMaster = decideInspectionPersist({
  asset_id: UNBOUND,
  master_id: "   ",
  ...evidence,
});
assert(omittedMaster.ok && omittedMaster.master_id === null, "blank master_id is omitted, not invented");

const masterScoped = decideInspectionPersist({
  asset_id: MUX,
  master_id: UNIVERSE,
  ...evidence,
});
assert(masterScoped.ok && masterScoped.scope === "master_scoped", "existing master-scoped persist remains valid");
assert(masterScoped.master_id === UNIVERSE, "optional master is authority context only");
assert(masterScoped.creates_canonical === false, "master-scoped persist still does not canonicalise");

const missing = decideInspectionPersist({ ...evidence });
assert(!missing.ok && missing.code === "missing_ids", "missing asset is rejected");

const invalidAsset = decideInspectionPersist({
  asset_id: "not-an-asset",
  ...evidence,
});
assert(!invalidAsset.ok && invalidAsset.code === "invalid_id", "invalid asset scope is rejected");

const invalidMaster = decideInspectionPersist({
  asset_id: UNBOUND,
  master_id: "not-a-master",
  ...evidence,
});
assert(!invalidMaster.ok && invalidMaster.code === "invalid_id", "invalid master scope is rejected");

const missingEvidence = decideInspectionPersist({
  asset_id: UNBOUND,
  metadata: { durationMs: 1 },
});
assert(!missingEvidence.ok && missingEvidence.code === "missing_evidence", "evidence arrays are required");

const notObject = decideInspectionPersist({
  asset_id: UNBOUND,
  metadata: [],
  frames: [],
  deltas: [],
  candidateTimestampsMs: [],
});
assert(!notObject.ok && notObject.code === "missing_evidence", "metadata must be an object");

assert(isInspectableAssetType("streaming-variant"), "unbound Livepeer streaming-variant is inspectable");
assert(isInspectableAssetType("original"), "original media is inspectable");
assert(!isInspectableAssetType("thumbnail"), "thumbnails are not inspectable");

console.log("Inspect persist contract tests: all passed");

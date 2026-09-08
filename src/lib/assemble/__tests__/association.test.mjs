import {
  mediaAssociationEligibility,
  buildUniverseAssociationTarget,
  decideCanonicalAssociation,
  projectionBelongsToUniverse,
  existingMediaBindRequest,
  associationStatusLabel,
  CREATE_WORK_HREF,
} from "../association";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const MURAL_PROJ = "2e68a8d6-6b15-4d16-a0d9-2ea290815f21";
const ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";
const UNBOUND = "bda79051-6bc9-497f-b0aa-12d95130290c";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";

const sheTarget = buildUniverseAssociationTarget({
  universeId: UNIVERSE,
  universeTitle: "Super Hero Ego",
  mural: { master_id: MURAL, title: "Super Hero Ego" },
  projectionId: MURAL_PROJ,
  boundAssetId: ASSET,
});

assert(sheTarget.compatible === true, "Super Hero Ego Mural projection is compatible");
const sheMural = { master_id: MURAL, parent_master_id: UNIVERSE };
assert(projectionBelongsToUniverse(MURAL, UNIVERSE, sheMural) === true, "Mural projection belongs to Super Hero Ego");
assert(projectionBelongsToUniverse(MURAL, OTHER_UNIVERSE, sheMural) === false, "Super Hero Ego Mural is not a child of another Universe");
assert(projectionBelongsToUniverse("other-mural", UNIVERSE, sheMural) === false, "wrong mural is rejected");

const playable = mediaAssociationEligibility({ readiness_overall: "playable", readiness_blockers: ["Rights not recorded"] });
assert(playable.eligible === true, "playable media is eligible even if rights are still pending");

const ready = mediaAssociationEligibility({ readiness_overall: "ready", readiness_blockers: [] });
assert(ready.eligible === true, "ready media is eligible");

const processing = mediaAssociationEligibility({
  readiness_overall: "processing",
  readiness_blockers: ["Media not yet ingested"],
});
assert(processing.eligible === false, "processing media is not eligible");
assert(processing.reasons.includes("Media not yet ingested"), "ineligible media explains why");

const already = decideCanonicalAssociation({
  assetId: ASSET,
  universeId: UNIVERSE,
  eligibility: playable,
  target: sheTarget,
});
assert(already.ok === true && already.action === "already_associated", "Mux asset is already associated with Super Hero Ego");
assert(already.bind.projection_id === MURAL_PROJ, "already-associated uses the existing Mural projection");
assert(already.bind.master_id === MURAL, "already-associated targets the Mural master, not the Universe master");
assert(already.bind.asset_id === ASSET, "already-associated keeps the Mux asset");

const occupied = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: playable,
  target: sheTarget,
});
assert(occupied.ok === false && occupied.code === "mural_occupied", "unbound media does not replace Super Hero Ego Mural media");

const emptyMural = buildUniverseAssociationTarget({
  universeId: UNIVERSE,
  universeTitle: "Super Hero Ego",
  mural: { master_id: MURAL, title: "Super Hero Ego" },
  projectionId: MURAL_PROJ,
  boundAssetId: null,
});
const bind = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: playable,
  target: emptyMural,
});
assert(bind.ok === true && bind.action === "bind", "unassociated eligible media can bind to an empty compatible Mural");
assert(bind.bind.projection_id === MURAL_PROJ, "bind uses the existing Mural projection");
assert(bind.bind.master_id === MURAL, "bind master_id is the Mural");
const request = existingMediaBindRequest(bind.bind);
assert(request.projection_id === MURAL_PROJ, "existing API payload includes projection_id");
assert(request.master_id === MURAL, "existing API payload includes mural master_id");
assert(request.asset_id === UNBOUND, "existing API payload includes asset_id");
assert(request.rights_holder_ref === null, "association does not invent rights");
assert(request.intake_id === null, "association does not invent intake");

const noUniverse = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: null,
  eligibility: playable,
  target: null,
});
assert(noUniverse.ok === false && noUniverse.code === "invalid_universe", "missing Universe is rejected");

const noMuralTarget = buildUniverseAssociationTarget({
  universeId: OTHER_UNIVERSE,
  universeTitle: null,
  mural: null,
  projectionId: null,
  boundAssetId: null,
});
assert(noMuralTarget.compatible === false && noMuralTarget.blocked_reason === "no_mural", "Universe without Mural is not compatible");
const noMural = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: OTHER_UNIVERSE,
  eligibility: playable,
  target: noMuralTarget,
});
assert(noMural.ok === false && noMural.code === "no_mural", "Universe without Mural is rejected cleanly");
assert(/does not create a Mural/i.test(noMural.message), "blocked state does not imply Mural creation");

const noProjectionTarget = buildUniverseAssociationTarget({
  universeId: UNIVERSE,
  universeTitle: "Super Hero Ego",
  mural: { master_id: MURAL, title: "Super Hero Ego" },
  projectionId: null,
  boundAssetId: null,
});
const noProjection = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: playable,
  target: noProjectionTarget,
});
assert(noProjection.ok === false && noProjection.code === "no_projection", "Mural without projection is rejected");

const ineligible = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: processing,
  target: emptyMural,
});
assert(ineligible.ok === false && ineligible.code === "ineligible", "ineligible media is rejected");

const wrongWork = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: playable,
  target: emptyMural,
  clientProjectionId: "not-the-mural-projection",
});
assert(wrongWork.ok === false && wrongWork.code === "wrong_work", "client projection that is not the Universe Mural is rejected");

const mismatchedTarget = decideCanonicalAssociation({
  assetId: UNBOUND,
  universeId: UNIVERSE,
  eligibility: playable,
  target: noMuralTarget,
});
assert(mismatchedTarget.ok === false && mismatchedTarget.code === "wrong_work", "target from a different Universe is rejected");

assert(associationStatusLabel({ universe_id: null, universe_title: null, mural_id: null, mural_title: null, scene_titles: [], bound_as: null }) === "Not associated", "unbound label");
assert(associationStatusLabel({ universe_id: UNIVERSE, universe_title: "Super Hero Ego", mural_id: MURAL, mural_title: "Super Hero Ego", scene_titles: [], bound_as: "mural" }) === "Super Hero Ego", "associated label uses Universe title");
assert(CREATE_WORK_HREF === "/authority/create", "blocked state links to existing Create Work, not a new workflow");

console.log("Assemble association tests: all passed");

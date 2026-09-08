import {
  availablePresenceOptions,
  decideAddPresence,
  decideRemovePresence,
} from "../presence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const REASON = "2745a50a-5417-4613-b23b-ef4857ab112e";
const OTHER_SCENE = "11111111-1111-4111-8111-111111111111";
const OTHER_MURAL = "22222222-2222-4222-8222-222222222222";
const OTHER_MOMENT = "33333333-3333-4333-8333-333333333333";

const powerhouse = { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: MURAL };
const mural = { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE };
const proverb = { master_id: PROVERB, canonical_type: "creative-moment", parent_master_id: UNIVERSE };
const reason = { master_id: REASON, canonical_type: "creative-moment", parent_master_id: UNIVERSE };
const otherScene = { master_id: OTHER_SCENE, canonical_type: "scene", parent_master_id: OTHER_MURAL };
const otherMural = { master_id: OTHER_MURAL, canonical_type: "mural", parent_master_id: OTHER_UNIVERSE };
const otherMoment = { master_id: OTHER_MOMENT, canonical_type: "creative-moment", parent_master_id: OTHER_UNIVERSE };

const add = decideAddPresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: REASON,
  scene: powerhouse,
  mural,
  moment: reason,
  universe_id: UNIVERSE,
  alreadyRelated: false,
});
assert(add.ok && add.action === "relate", "existing Scene + existing Creative Moment can be related");
assert(add.creates_projection === false && add.creates_media === false, "relating does not create playback or media");
assert(add.deletes_objects === false, "relating does not create or delete canonical objects");

const duplicate = decideAddPresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: PROVERB,
  scene: powerhouse,
  mural,
  moment: proverb,
  universe_id: UNIVERSE,
  alreadyRelated: true,
});
assert(duplicate.ok && duplicate.action === "already_related", "existing relationship is not duplicated");
assert(duplicate.creates_projection === false, "duplicate relate still does not fabricate a projection");

const remove = decideRemovePresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: REASON,
  scene: powerhouse,
  mural,
  moment: reason,
  universe_id: UNIVERSE,
  alreadyRelated: true,
});
assert(remove.ok && remove.action === "unrelate", "existing relationship can be removed");
assert(remove.deletes_objects === false, "removing presence does not delete Scene or Creative Moment");

const missing = decideRemovePresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: REASON,
  scene: powerhouse,
  mural,
  moment: reason,
  alreadyRelated: false,
});
assert(!missing.ok && missing.code === "missing_relation", "removing a missing relationship is rejected");

const otherUniverseScene = decideAddPresence({
  scene_master_id: OTHER_SCENE,
  moment_master_id: PROVERB,
  scene: otherScene,
  mural: otherMural,
  moment: proverb,
  universe_id: UNIVERSE,
  alreadyRelated: false,
});
assert(!otherUniverseScene.ok && otherUniverseScene.code === "wrong_universe", "Scene from another Universe/Mural is rejected");

const otherUniverseMoment = decideAddPresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: OTHER_MOMENT,
  scene: powerhouse,
  mural,
  moment: otherMoment,
  universe_id: UNIVERSE,
  alreadyRelated: false,
});
assert(!otherUniverseMoment.ok && otherUniverseMoment.code === "wrong_universe", "Creative Moment from another Universe is rejected");

const notScene = decideAddPresence({
  scene_master_id: MURAL,
  moment_master_id: PROVERB,
  scene: mural,
  mural,
  moment: proverb,
  alreadyRelated: false,
});
assert(!notScene.ok && notScene.code === "not_scene", "non-Scene subjects cannot be related as Scenes");

const identityOnly = decideAddPresence({
  scene_master_id: POWERHOUSE,
  moment_master_id: PROVERB,
  scene: powerhouse,
  mural,
  moment: proverb,
  alreadyRelated: false,
});
assert(identityOnly.ok && identityOnly.creates_projection === false && identityOnly.creates_media === false, "identity-only Creative Moment stays identity-only");

assert(decideAddPresence({
  scene_master_id: "",
  moment_master_id: PROVERB,
  scene: null,
  mural: null,
  moment: proverb,
  alreadyRelated: false,
}).code === "missing_ids", "missing ids are rejected");

const candidates = availablePresenceOptions(
  [{ master_id: PROVERB, title: "Proverb" }, { master_id: REASON, title: "Reason" }],
  [PROVERB],
);
assert(candidates.length === 1 && candidates[0].master_id === REASON, "already-present Creative Moments are not offered again");

console.log("Assemble presence authoring tests: all passed");

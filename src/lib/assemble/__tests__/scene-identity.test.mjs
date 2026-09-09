import { decideSceneIdentity } from "../scene-identity";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const OTHER_SCENE = "11111111-1111-4111-8111-111111111111";
const OTHER_MURAL = "22222222-2222-4222-8222-222222222222";

const powerhouse = { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: MURAL };
const mural = { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE };
const otherScene = { master_id: OTHER_SCENE, canonical_type: "scene", parent_master_id: OTHER_MURAL };
const otherMural = { master_id: OTHER_MURAL, canonical_type: "mural", parent_master_id: OTHER_UNIVERSE };

const named = decideSceneIdentity({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  title: "  Powerhouse  ",
  description: "  Central city manifestation  ",
  scene: powerhouse,
  mural,
});
assert(named.ok && named.action === "update_identity", "an existing Scene can be named");
assert(named.identity.title === "Powerhouse", "title is trimmed");
assert(named.identity.description === "Central city manifestation", "description is trimmed");
assert(named.touches_timing === false && named.touches_order === false, "identity does not change timing or order");
assert(named.creates_scene === false && named.creates_projection === false && named.creates_media === false, "identity does not create objects or media");

const contributorPrefixed = decideSceneIdentity({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  title: "Golden Shovel — Powerhouse",
  description: "Golden Shovel's warrior manifestation within the Super Hero Ego Mural. Central city/skyline focal manifestation; powerhouse with spirit-avatar presence.",
  scene: powerhouse,
  mural,
});
assert(contributorPrefixed.ok && contributorPrefixed.identity.title === "Golden Shovel — Powerhouse", "current Super Hero Ego title remains valid");

const blank = decideSceneIdentity({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  title: "   ",
  scene: powerhouse,
  mural,
});
assert(!blank.ok && blank.code === "invalid_identity", "blank title is rejected");

const notScene = decideSceneIdentity({
  universe_id: UNIVERSE,
  scene_master_id: MURAL,
  title: "Powerhouse",
  scene: mural,
  mural,
});
assert(!notScene.ok && notScene.code === "not_scene", "non-Scene subjects cannot be named as Scenes");

const otherUniverse = decideSceneIdentity({
  universe_id: UNIVERSE,
  scene_master_id: OTHER_SCENE,
  title: "Powerhouse",
  scene: otherScene,
  mural: otherMural,
});
assert(!otherUniverse.ok && otherUniverse.code === "wrong_universe", "Scene from another Universe is rejected");

const missing = decideSceneIdentity({
  title: "Powerhouse",
  scene: null,
  mural: null,
});
assert(!missing.ok && missing.code === "missing_ids", "missing Scene is rejected");

console.log("Assemble Scene identity tests: all passed");

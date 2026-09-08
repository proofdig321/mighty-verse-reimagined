import { parseTimelineMs } from "../../media/timing";
import { decideSceneTiming } from "../scene-timing";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const BINDING = "6ca3869d-ca39-4422-bfd1-8b1353d64ea5";
const OTHER_BINDING = "11111111-1111-4111-8111-111111111111";
const OTHER_SCENE = "22222222-2222-4222-8222-222222222222";
const OTHER_MURAL = "33333333-3333-4333-8333-333333333333";

assert(parseTimelineMs(36000) === 36000, "integer ms is canonical");
assert(parseTimelineMs("36000") === 36000, "integer ms string is accepted");
assert(parseTimelineMs("0:36") === 36000, "0:36 is accepted");
assert(parseTimelineMs("0:36.000") === 36000, "0:36.000 is accepted");
assert(parseTimelineMs("1:19.000") === 79000, "1:19.000 is accepted");
assert(parseTimelineMs("0:36.5") === 36500, "fractional seconds pad to ms");
assert(parseTimelineMs("0:60") == null, "invalid seconds are rejected");
assert(parseTimelineMs("-1") == null, "negative strings are rejected");
assert(parseTimelineMs(-1) == null, "negative numbers are rejected");

const powerhouse = { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: MURAL };
const mural = { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE };
const binding = { binding_id: BINDING, projection_id: "3039ca84-7e11-4eb6-8895-d16d13a899c3", master_id: POWERHOUSE };

const named = decideSceneTiming({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  binding_id: BINDING,
  start_ms: "0:36.000",
  end_ms: "1:19",
  scene: powerhouse,
  mural,
  binding,
});
assert(named.ok && named.action === "update_timing", "an existing Scene window can be shaped");
assert(named.start_ms === 36000 && named.end_ms === 79000, "clock values become milliseconds");
assert(named.creates_scene === false && named.creates_media === false, "timing does not create Scenes or media");
assert(named.touches_identity === false && named.touches_order === false, "timing does not rename or reorder");

const inverted = decideSceneTiming({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  binding_id: BINDING,
  start_ms: 79000,
  end_ms: 36000,
  scene: powerhouse,
  mural,
  binding,
});
assert(!inverted.ok && inverted.code === "invalid_range", "end must be after start");

const otherBinding = decideSceneTiming({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  binding_id: OTHER_BINDING,
  start_ms: 36000,
  end_ms: 79000,
  scene: powerhouse,
  mural,
  binding,
});
assert(!otherBinding.ok && otherBinding.code === "binding_mismatch", "another Scene's binding is rejected");

const otherUniverse = decideSceneTiming({
  universe_id: UNIVERSE,
  scene_master_id: OTHER_SCENE,
  binding_id: OTHER_BINDING,
  start_ms: 36000,
  end_ms: 79000,
  scene: { master_id: OTHER_SCENE, canonical_type: "scene", parent_master_id: OTHER_MURAL },
  mural: { master_id: OTHER_MURAL, canonical_type: "mural", parent_master_id: OTHER_UNIVERSE },
  binding: { binding_id: OTHER_BINDING, projection_id: OTHER_SCENE, master_id: OTHER_SCENE },
});
assert(!otherUniverse.ok && otherUniverse.code === "wrong_universe", "Scene from another Universe is rejected");

const missing = decideSceneTiming({
  start_ms: 36000,
  end_ms: 79000,
  scene: null,
  mural: null,
  binding: null,
});
assert(!missing.ok && missing.code === "missing_ids", "missing Scene is rejected");

console.log("Assemble Scene timing tests: all passed");

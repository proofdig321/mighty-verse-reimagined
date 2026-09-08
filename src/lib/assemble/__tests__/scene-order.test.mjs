import { decideSceneOrder, proposeMovedSceneOrder } from "../scene-order";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const OTHER_MURAL = "11111111-1111-4111-8111-111111111111";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const DARK_KNIGHT = "bebb65d2-21ed-4bc9-9fa0-a4857df30a43";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const SWORD_MASTER = "65490a92-8faf-42ea-a391-0e6473360f5c";

const ids = [POWERHOUSE, DARK_KNIGHT, HAND_TO_HAND, SWORD_MASTER];
const mural = { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE };
const scenes = ids.map((master_id) => ({
  master_id,
  canonical_type: "scene",
  parent_master_id: MURAL,
}));

const later = proposeMovedSceneOrder(ids, POWERHOUSE, "later");
assert(
  later && later[0] === DARK_KNIGHT && later[1] === POWERHOUSE,
  "Move later swaps with the next Scene",
);
assert(proposeMovedSceneOrder(ids, POWERHOUSE, "earlier") == null, "first Scene cannot move earlier");
assert(proposeMovedSceneOrder(ids, SWORD_MASTER, "later") == null, "last Scene cannot move later");

const ordered = decideSceneOrder({
  universe_id: UNIVERSE,
  mural_id: MURAL,
  ordered_scene_ids: later,
  scenes,
  mural,
});
assert(ordered.ok && ordered.action === "update_order", "a permutation of this Mural's Scenes can be saved");
assert(ordered.orders[0].master_id === DARK_KNIGHT && ordered.orders[0].sort_order === 1, "sort_order is 1..n");
assert(ordered.imports_shuffle === false, "canonical order does not import Scene Deck shuffle");
assert(ordered.creates_scene === false, "order does not create Scenes");

const missing = decideSceneOrder({
  universe_id: UNIVERSE,
  mural_id: MURAL,
  ordered_scene_ids: [POWERHOUSE, DARK_KNIGHT, HAND_TO_HAND],
  scenes,
  mural,
});
assert(!missing.ok && missing.code === "order_mismatch", "partial order is rejected");

const foreign = decideSceneOrder({
  universe_id: UNIVERSE,
  mural_id: MURAL,
  ordered_scene_ids: [...ids.slice(0, 3), "22222222-2222-4222-8222-222222222222"],
  scenes,
  mural,
});
assert(!foreign.ok && foreign.code === "order_mismatch", "a Scene from outside the set is rejected");

const otherUniverse = decideSceneOrder({
  universe_id: UNIVERSE,
  mural_id: OTHER_MURAL,
  ordered_scene_ids: ids,
  scenes: ids.map((master_id) => ({ master_id, canonical_type: "scene", parent_master_id: OTHER_MURAL })),
  mural: { master_id: OTHER_MURAL, canonical_type: "mural", parent_master_id: OTHER_UNIVERSE },
});
assert(!otherUniverse.ok && otherUniverse.code === "wrong_universe", "order from another Universe is rejected");

console.log("Assemble Scene order tests: all passed");

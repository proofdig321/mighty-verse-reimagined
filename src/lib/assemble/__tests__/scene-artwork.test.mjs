import { decideSceneArtwork } from "../scene-artwork";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const OTHER_MURAL = "33333333-3333-4333-8333-333333333333";
const OTHER_SCENE = "22222222-2222-4222-8222-222222222222";
const STILL = "https://image.mux.com/JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4/thumbnail.jpg?time=36";

const scene = { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: MURAL };
const mural = { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE };

const named = decideSceneArtwork({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  thumbnail_url: STILL,
  scene,
  mural,
});
assert(named.ok && named.action === "set_artwork", "an existing Scene can take a still");
assert(named.thumbnail_url === STILL, "HTTPS Mux thumbnail is kept");
assert(named.creates_scene === false && named.creates_media_window === false, "still does not create Scenes or windows");

const http = decideSceneArtwork({
  universe_id: UNIVERSE,
  scene_master_id: POWERHOUSE,
  thumbnail_url: "http://example.com/still.jpg",
  scene,
  mural,
});
assert(!http.ok && http.code === "invalid_url", "HTTP stills are rejected");

const missing = decideSceneArtwork({
  thumbnail_url: STILL,
  scene: null,
  mural: null,
});
assert(!missing.ok && missing.code === "missing_ids", "missing Scene is rejected");

const otherUniverse = decideSceneArtwork({
  universe_id: UNIVERSE,
  scene_master_id: OTHER_SCENE,
  thumbnail_url: STILL,
  scene: { master_id: OTHER_SCENE, canonical_type: "scene", parent_master_id: OTHER_MURAL },
  mural: { master_id: OTHER_MURAL, canonical_type: "mural", parent_master_id: OTHER_UNIVERSE },
});
assert(!otherUniverse.ok && otherUniverse.code === "wrong_universe", "Scene from another Universe is rejected");

console.log("Assemble Scene artwork tests: all passed");

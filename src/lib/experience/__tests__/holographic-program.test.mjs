import { composeHolographicProgram, audienceLabel, audienceLayerTitle, layerIsActive, activeWindow } from "../holographic-program";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const DARK_KNIGHT = "bebb65d2-21ed-4bc9-9fa0-a4857df30a43";
const PLAYBACK = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

const layers = [
  {
    layer_id: "mural-1",
    kind: "mural",
    master_id: MURAL,
    title: "Super Hero Ego",
    still_url: "https://image.mux.com/x/thumbnail.jpg?time=0",
    depth: 0,
    offset_x: 0,
    offset_y: 0,
    related_scene_ids: [POWERHOUSE, DARK_KNIGHT],
    start_ms: 0,
    end_ms: 254000,
    playback_endpoint: null,
  },
  {
    layer_id: "scene-1",
    kind: "scene",
    master_id: POWERHOUSE,
    title: "Golden Shovel — Powerhouse",
    still_url: "https://image.mux.com/x/thumbnail.jpg?time=36",
    depth: 72,
    offset_x: -54,
    offset_y: -8,
    related_scene_ids: [POWERHOUSE],
    start_ms: 36000,
    end_ms: 79000,
    playback_endpoint: null,
  },
  {
    layer_id: "scene-2",
    kind: "scene",
    master_id: DARK_KNIGHT,
    title: "Mothipa — Dark Knight",
    still_url: "https://image.mux.com/x/thumbnail.jpg?time=80",
    depth: 144,
    offset_x: 54,
    offset_y: 22,
    related_scene_ids: [DARK_KNIGHT],
    start_ms: 80000,
    end_ms: 124000,
    playback_endpoint: null,
  },
];

const program = composeHolographicProgram({
  title: "Super Hero Ego",
  layers,
  source: {
    asset_id: "795c057e-2967-4e93-8f5e-06297c674cb0",
    title: "Super Hero Ego",
    provider: "mux",
    playback_id: PLAYBACK,
    endpoint_ref: `https://stream.mux.com/${PLAYBACK}.m3u8`,
    duration_ms: 254800,
    mural_id: MURAL,
    mural_title: "Super Hero Ego",
    mural_projection_id: "2e68a8d6-6b15-4d16-a0d9-2ea290815f21",
    mural_canonical_state_id: MURAL,
    windows: [
      { scene_master_id: POWERHOUSE, title: "Golden Shovel — Powerhouse", start_ms: 36000, end_ms: 79000 },
      { scene_master_id: DARK_KNIGHT, title: "Mothipa — Dark Knight", start_ms: 80000, end_ms: 124000 },
    ],
  },
});

assert(program.creates_scene === false, "program never creates Scenes");
assert(program.clock?.endpoint_ref.includes("stream.mux.com"), "mural clock uses Mux HLS");
assert(program.windows.length === 2, "canonical Scene windows drive temporal progression");
assert(activeWindow(program.windows, 10000) === null, "opening is before the first Scene");
assert(activeWindow(program.windows, 36000)?.title === "Golden Shovel — Powerhouse", "Powerhouse is active at 0:36");
assert(layerIsActive(program.layers.find((layer) => layer.kind === "mural"), 0) === true, "mural stays the audiovisual foundation");
assert(layerIsActive(program.layers.find((layer) => layer.master_id === POWERHOUSE), 36000) === true, "Powerhouse plane activates in its window");
assert(layerIsActive(program.layers.find((layer) => layer.master_id === POWERHOUSE), 80000) === false, "Powerhouse plane deactivates after its window");
assert(audienceLabel(UNIVERSE, "Experience") === "Experience", "internal identifiers are not audience labels");
assert(audienceLabel("Super Hero Ego", "Experience") === "Super Hero Ego", "the Universe title remains the audience name");
assert(audienceLayerTitle("Golden Shovel — Powerhouse production", "Realization") === "Golden Shovel — Powerhouse", "production suffix is not an audience label");

console.log("Holographic program tests: all passed");

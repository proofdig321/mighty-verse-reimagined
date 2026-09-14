import { playableGallerySources } from "../gallery-source";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "795c057e-2967-4e93-8f5e-06297c674cb0";
const FR = "5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c";

function mediaRow(overrides) {
  return {
    asset_id: SHE,
    title: "Super Hero Ego",
    provider: "mux",
    storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
    duration_ms: 254800,
    work_type: "song",
    readiness_overall: "playable",
    readiness_blockers: [],
    inspection: null,
    association: {
      universe_id: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
      universe_title: "Super Hero Ego",
      mural_id: "a75ae8af-7b48-4b67-8392-d89447bae370",
      mural_title: "Super Hero Ego",
      scene_titles: [],
      bound_as: "mural",
    },
    ...overrides,
  };
}

const gallery = playableGallerySources([
  mediaRow({}),
  mediaRow({
    asset_id: FR,
    title: "Father Raymond",
    storage_ref: "014sJhmHHRL2g52G14xG00L6MTyq4zvunCsZtFStk4Wds",
    association: {
      universe_id: null,
      universe_title: null,
      mural_id: null,
      mural_title: null,
      scene_titles: [],
      bound_as: null,
    },
  }),
  mediaRow({
    asset_id: "11111111-1111-4111-8111-111111111111",
    storage_ref: "seed:placeholder:waiting",
    readiness_overall: "processing",
    readiness_blockers: ["Media not yet ingested"],
  }),
]);

assert(gallery.length === 2, "placeholder processing media is not offered as a gallery pick");
assert(gallery[0].asset_id === SHE && gallery[1].asset_id === FR, "playable Mux sources stay selectable");
assert(gallery[0].associated_title === "Super Hero Ego", "already-bound media still appears so it can be reused on another empty Mural");

console.log("Assemble gallery source tests: all passed");

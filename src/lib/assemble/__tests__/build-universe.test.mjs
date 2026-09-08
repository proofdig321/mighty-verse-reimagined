import { buildUniverseAssembly } from "../build-universe";
import { suiteScenes } from "../suite";

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const DARK_KNIGHT = "bebb65d2-21ed-4bc9-9fa0-a4857df30a43";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const SWORD_MASTER = "65490a92-8faf-42ea-a391-0e6473360f5c";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const MOTHIPA = "32422bb4-d03c-465d-8348-942e49ae0051";
const REASON = "2745a50a-5417-4613-b23b-ef4857ab112e";
const MURAL_PROJECTION = "2e68a8d6-6b15-4d16-a0d9-2ea290815f21";
const MUX_ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";
const MUX_PLAYBACK = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const assembly = buildUniverseAssembly({
  master: { master_id: UNIVERSE, created_at: "2026-08-19T18:46:41.825857+00:00" },
  presentation: { title: "Super Hero Ego", description: "Golden Shovel ft Proverb, Reason and Mothipa" },
  muralMasters: [{ master_id: MURAL }],
  momentMasters: [{ master_id: PROVERB }, { master_id: MOTHIPA }, { master_id: REASON }],
  sceneMasters: [
    { master_id: POWERHOUSE, parent_master_id: MURAL, sort_order: 1 },
    { master_id: DARK_KNIGHT, parent_master_id: MURAL, sort_order: 2 },
    { master_id: HAND_TO_HAND, parent_master_id: MURAL, sort_order: 3 },
    { master_id: SWORD_MASTER, parent_master_id: MURAL, sort_order: 4 },
  ],
  presentations: [
    { master_id: MURAL, title: "Super Hero Ego" },
    { master_id: POWERHOUSE, title: "Golden Shovel — Powerhouse" },
    { master_id: DARK_KNIGHT, title: "Mothipa — Dark Knight" },
    { master_id: HAND_TO_HAND, title: "ProVerb — Hand-to-Hand" },
    { master_id: SWORD_MASTER, title: "Reason — Sword Master" },
    { master_id: PROVERB, title: "Proverb" },
    { master_id: MOTHIPA, title: "Mothipa" },
    { master_id: REASON, title: "Reason" },
  ],
  sceneProjections: [
    { projection_id: "3039ca84-7e11-4eb6-8895-d16d13a899c3", master_id: POWERHOUSE },
    { projection_id: "bb802400-b385-4025-9bb8-63df53abd9be", master_id: DARK_KNIGHT },
    { projection_id: "9c045ea3-ab09-4a6f-b89c-02dce076b8da", master_id: HAND_TO_HAND },
    { projection_id: "8100033e-4c7e-448f-8b9c-b9ff97fdc3fd", master_id: SWORD_MASTER },
  ],
  muralProjections: [{ projection_id: MURAL_PROJECTION, master_id: MURAL }],
  momentProjections: [
    { projection_id: "718372da-4941-41d6-bb64-3a0b0812b047", master_id: MOTHIPA },
    { projection_id: "89ba1c24-01c1-4bbd-8ed1-d48021600b71", master_id: REASON },
  ],
  bindings: [
    { projection_id: "3039ca84-7e11-4eb6-8895-d16d13a899c3", start_ms: 36000, end_ms: 79000, asset_id: MUX_ASSET },
    { projection_id: "bb802400-b385-4025-9bb8-63df53abd9be", start_ms: 80000, end_ms: 124000, asset_id: MUX_ASSET },
    { projection_id: "9c045ea3-ab09-4a6f-b89c-02dce076b8da", start_ms: 149000, end_ms: 192000, asset_id: MUX_ASSET },
    { projection_id: "8100033e-4c7e-448f-8b9c-b9ff97fdc3fd", start_ms: 193000, end_ms: 254000, asset_id: MUX_ASSET },
    { projection_id: MURAL_PROJECTION, start_ms: 0, end_ms: 254800, asset_id: MUX_ASSET },
  ],
  assets: [{ asset_id: MUX_ASSET, provider: "mux", storage_ref: MUX_PLAYBACK }],
  relations: [
    { scene_master_id: POWERHOUSE, moment_master_id: PROVERB },
    { scene_master_id: DARK_KNIGHT, moment_master_id: MOTHIPA },
    { scene_master_id: HAND_TO_HAND, moment_master_id: PROVERB },
    { scene_master_id: SWORD_MASTER, moment_master_id: REASON },
  ],
});

assert(assembly.title === "Super Hero Ego", "universe title");
assert(assembly.murals.length === 1 && assembly.murals[0].master_id === MURAL, "one mural");
assert(assembly.murals[0].has_media === true, "mural has bound media");
assert(assembly.murals[0].storage_ref === MUX_PLAYBACK, "mural still uses Mux storage_ref");
assert(assembly.murals[0].scenes.length === 4, "four scenes");
assert(assembly.creative_moments.length === 3, "three creative moments");

const scenes = Object.fromEntries(assembly.murals[0].scenes.map((scene) => [scene.master_id, scene]));
assert(scenes[POWERHOUSE].creative_moment_id === PROVERB, "Powerhouse → Proverb");
assert(scenes[POWERHOUSE].creative_moments.length === 1, "Powerhouse currently has one related Creative Moment");
assert(scenes[POWERHOUSE].storage_ref === MUX_PLAYBACK, "Powerhouse still maps Mux asset");
assert(scenes[HAND_TO_HAND].creative_moment_id === PROVERB, "Hand-to-Hand shares Proverb");
assert(scenes[DARK_KNIGHT].creative_moment_title === "Mothipa", "Dark Knight → Mothipa");
assert(scenes[SWORD_MASTER].creative_moment_title === "Reason", "Sword Master → Reason");

const proverb = assembly.creative_moments.find((moment) => moment.master_id === PROVERB);
assert(proverb && proverb.has_experience === false, "Proverb is identity-only");
assert(proverb.scene_titles.length === 2, "Proverb related to two Scenes");
assert(proverb.scene_ids.includes(POWERHOUSE) && proverb.scene_ids.includes(HAND_TO_HAND), "Proverb scene_ids preserve sharing");

const mothipa = assembly.creative_moments.find((moment) => moment.master_id === MOTHIPA);
assert(mothipa && mothipa.has_experience === true, "Mothipa has an experiential projection");

const suite = suiteScenes(assembly);
assert(suite.length === 4, "suite flattens four Scenes");
assert(suite.every((scene) => scene.mural_id === MURAL), "Scenes remain mural children, not Universe-owned");
assert(suite.find((scene) => scene.master_id === POWERHOUSE)?.creative_moment_title === "Proverb", "Powerhouse still related to Proverb");

console.log("Assemble Universe assembly tests: all passed");

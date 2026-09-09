import { associateAssetWithCanonicalWork, mediaIsCanonicalUniverse, mediaInspectHref, creativeSuiteHref, creativeSuiteSentinelHref, creativeSuiteWorkspaceHref, curateStudioHref, curateHubHref, curateSentinelHref, curateMuralHref, curateMomentHref, curateIncomingHref } from "../studio";
import { creativeSuiteNavItems, resolveStudioHash, suiteChildHref } from "../suite";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";
const MURAL_PROJ = "mural-proj";
const POWERHOUSE_PROJ = "3039ca84-7e11-4eb6-8895-d16d13a899c3";
const HAND_PROJ = "9c045ea3-ab09-4a6f-b89c-02dce076b8da";

const masters = [
  { master_id: UNIVERSE, canonical_type: "universe", parent_master_id: null },
  { master_id: MURAL, canonical_type: "mural", parent_master_id: UNIVERSE },
  { master_id: POWERHOUSE, canonical_type: "scene", parent_master_id: MURAL },
  { master_id: HAND_TO_HAND, canonical_type: "scene", parent_master_id: MURAL },
];

const presentations = [
  { master_id: UNIVERSE, title: "Super Hero Ego" },
  { master_id: MURAL, title: "Super Hero Ego" },
  { master_id: POWERHOUSE, title: "Golden Shovel — Powerhouse" },
  { master_id: HAND_TO_HAND, title: "ProVerb — Hand-to-Hand" },
];

const projections = [
  { projection_id: MURAL_PROJ, master_id: MURAL },
  { projection_id: POWERHOUSE_PROJ, master_id: POWERHOUSE },
  { projection_id: HAND_PROJ, master_id: HAND_TO_HAND },
];

const bindings = [
  { asset_id: ASSET, projection_id: MURAL_PROJ },
  { asset_id: ASSET, projection_id: POWERHOUSE_PROJ },
  { asset_id: ASSET, projection_id: HAND_PROJ },
];

const associated = associateAssetWithCanonicalWork({
  assetId: ASSET,
  bindings,
  projections,
  masters,
  presentations,
});

assert(associated.universe_id === UNIVERSE, "Mux asset resolves to Super Hero Ego Universe");
assert(associated.universe_title === "Super Hero Ego", "Universe title is Super Hero Ego");
assert(associated.mural_id === MURAL, "Mux asset is bound to the Mural");
assert(associated.bound_as === "mural", "primary bound_as is mural, not universe");
assert(associated.scene_titles.includes("Golden Shovel — Powerhouse"), "Powerhouse remains a related Scene");
assert(associated.scene_titles.includes("ProVerb — Hand-to-Hand"), "Hand-to-Hand remains a related Scene");
assert(mediaIsCanonicalUniverse(ASSET, associated) === false, "MEDIA ≠ UNIVERSE");

const unbound = associateAssetWithCanonicalWork({
  assetId: "unbound-asset",
  bindings,
  projections,
  masters,
  presentations,
});
assert(unbound.universe_id === null, "unbound media has no Universe");
assert(unbound.bound_as === null, "unbound media is not a canonical work");

const sceneOnly = associateAssetWithCanonicalWork({
  assetId: ASSET,
  bindings: [{ asset_id: ASSET, projection_id: POWERHOUSE_PROJ }],
  projections,
  masters,
  presentations,
});
assert(sceneOnly.universe_id === UNIVERSE, "Scene binding still walks to the Universe");
assert(sceneOnly.mural_id === MURAL, "Scene parent Mural is retained");
assert(sceneOnly.bound_as === "scene", "scene-only binding is not mural ownership of the Creative Moment");

assert(mediaInspectHref(ASSET) === `/authority/media/inspect?assetId=${ASSET}`, "inspect reuses the existing media inspect route");
assert(creativeSuiteHref(UNIVERSE, "curate") === `/authority/universes/${UNIVERSE}?from=curate`, "suite href preserves Curate origin");
assert(creativeSuiteSentinelHref(UNIVERSE) === `/authority/universes/${UNIVERSE}/storyboard?source=sentinel`, "inspect continues into Suite Sentinel without merging the surfaces");
assert(curateHubHref(UNIVERSE) === `/authority/curate/${UNIVERSE}`, "occupied work opens a Curate Hub child route");
assert(curateSentinelHref(UNIVERSE) === `/authority/curate/${UNIVERSE}/sentinel`, "Sentinel is a child page, not a stacked section");
assert(curateMuralHref(UNIVERSE) === `/authority/curate/${UNIVERSE}/mural`, "Mural registration is a child page");
assert(curateMomentHref(UNIVERSE) === `/authority/curate/${UNIVERSE}/moment`, "Creative Moment registration is a child page");
assert(curateStudioHref(UNIVERSE) === `/authority/curate/${UNIVERSE}`, "universe occupancy is the hub path");
assert(curateStudioHref(null, ASSET) === `/authority/curate?asset=${ASSET}`, "Gallery / Inspect context stays on the incoming catalogue");
assert(
  curateStudioHref(UNIVERSE, ASSET) === `/authority/curate/${UNIVERSE}`,
  "bound work occupancy prefers the hub over stacking asset query onto the index",
);
assert(curateIncomingHref(ASSET) === `/authority/curate?asset=${ASSET}`, "incoming attach stays on the catalogue");
assert(curateStudioHref() === "/authority/curate", "Curate without context stays on the incoming catalogue");

const suite = `/authority/universes/${UNIVERSE}`;
const nav = creativeSuiteNavItems(suite);
assert(nav.map((item) => item.id).join(",") === "overview,storyboard,scenes,production,preview,experience", "Studio nav is workspaces, not a stacked ontology dump");
assert(nav.find((item) => item.id === "storyboard")?.href === `${suite}/storyboard`, "Storyboard is a child route");
assert(nav.find((item) => item.id === "preview")?.href === `${suite}/preview`, "2.5D is a child route");
assert(suiteChildHref(`${suite}?from=curate`, "scenes") === `${suite}/scenes?from=curate`, "child routes preserve Curate origin");
assert(creativeSuiteWorkspaceHref(UNIVERSE, "sentinel") === `${suite}/storyboard?source=sentinel`, "Sentinel evidence lives on Storyboard");
assert(resolveStudioHash("universe-sentinel")?.path === "storyboard", "legacy Sentinel hash maps to Storyboard");
assert(resolveStudioHash("universe-scene-4790c7cf-bb19-4a01-a243-e5c3eb680555")?.path === "scenes/4790c7cf-bb19-4a01-a243-e5c3eb680555", "legacy Scene hash maps to the Scene workspace");

console.log("Assemble Curate Studio tests: all passed");

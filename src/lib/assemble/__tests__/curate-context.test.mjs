import {
  pinFocusedIncomingMedia,
  resolveCurateAssetFocus,
  resolveCurateUniverseSelection,
} from "../curate-context";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const OTHER_UNIVERSE = "f11c3aba-2dcb-473a-b982-1b7442bd32b3";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";
const UNBOUND = "bda79051-6bc9-497f-b0aa-12d95130290c";
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

function mediaRow(overrides) {
  return {
    asset_id: UNBOUND,
    title: "Unbound livepeer",
    provider: "livepeer",
    storage_ref: "livepeer:playback",
    duration_ms: 1000,
    work_type: "video",
    readiness_overall: "playable",
    readiness_blockers: [],
    inspection: null,
    association: {
      universe_id: null,
      universe_title: null,
      mural_id: null,
      mural_title: null,
      scene_titles: [],
      bound_as: null,
    },
    ...overrides,
  };
}

const bound = mediaRow({
  asset_id: ASSET,
  title: "Super Hero Ego",
  provider: "mux",
  association: {
    universe_id: UNIVERSE,
    universe_title: "Super Hero Ego",
    mural_id: MURAL,
    mural_title: "Super Hero Ego",
    scene_titles: ["Golden Shovel — Powerhouse"],
    bound_as: "mural",
  },
});
const unbound = mediaRow({ asset_id: UNBOUND });
const catalogue = [unbound, bound];

assert(resolveCurateAssetFocus({ requestedAssetId: null, media: catalogue }) === null, "no asset query means no focus");
assert(resolveCurateAssetFocus({ requestedAssetId: "  ", media: catalogue }) === null, "blank asset query means no focus");

const fromGallery = resolveCurateAssetFocus({ requestedAssetId: UNBOUND, media: catalogue });
assert(fromGallery.found === true, "Gallery asset is found in Curate catalogue");
assert(fromGallery.bound === false, "unbound asset is not treated as associated");
assert(fromGallery.next === "associate", "unbound continuation offers association");
assert(fromGallery.universe_id === null, "unbound asset does not invent a Universe");

const fromInspect = resolveCurateAssetFocus({ requestedAssetId: ASSET, media: catalogue });
assert(fromInspect.found === true, "Inspected Super Hero Ego Mux asset is found");
assert(fromInspect.bound === true, "Mux asset remains bound");
assert(fromInspect.next === "creative_suite", "bound continuation is Creative Suite, not association");
assert(fromInspect.universe_id === UNIVERSE, "bound focus keeps Super Hero Ego Universe");
assert(fromInspect.universe_title === "Super Hero Ego", "bound focus keeps Super Hero Ego title");

const spoofedUniverse = resolveCurateUniverseSelection({
  requestedUniverseId: OTHER_UNIVERSE,
  focusedAsset: fromInspect,
});
assert(spoofedUniverse === OTHER_UNIVERSE, "explicit universe query still selects occupancy context");
assert(fromInspect.next === "creative_suite", "spoofed universe query cannot change bound next action");
assert(fromInspect.universe_id === UNIVERSE, "spoofed universe query cannot reassign the Mux asset");

assert(
  resolveCurateUniverseSelection({ requestedUniverseId: null, focusedAsset: fromInspect }) === null,
  "bound asset does not auto-open a Universe hub from the incoming catalogue",
);
assert(
  resolveCurateUniverseSelection({ requestedUniverseId: null, focusedAsset: fromGallery }) === null,
  "unbound asset does not invent a Universe selection",
);

const unknown = resolveCurateAssetFocus({ requestedAssetId: UNKNOWN, media: catalogue });
assert(unknown.found === false, "unknown UUID is not invented");
assert(unknown.next === "unavailable", "unknown asset is unavailable in Curate Studio");
assert(unknown.bound === false, "unknown asset is not treated as bound");

const invalid = resolveCurateAssetFocus({ requestedAssetId: "not-an-asset", media: catalogue });
assert(invalid.next === "unavailable", "non-UUID context cannot bypass catalogue lookup");

const pinned = pinFocusedIncomingMedia(catalogue, ASSET);
assert(pinned[0].asset_id === ASSET, "focused bound asset is pinned to the top of incoming media");
assert(pinned[1].asset_id === UNBOUND, "remaining catalogue is preserved");
assert(pinFocusedIncomingMedia(catalogue, UNBOUND)[0].asset_id === UNBOUND, "already-first focus is unchanged");
assert(pinFocusedIncomingMedia(catalogue, UNKNOWN) === catalogue, "unknown focus does not reorder the catalogue");

console.log("Assemble Curate context tests: all passed");

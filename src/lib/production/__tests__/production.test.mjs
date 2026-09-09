import { classifyGalleryAssetRole, classifyLifecycleKind, galleryRoleLabel, isGalleryProductionAsset } from "../lifecycle";
import { decideRetainReference, parseReferenceProvenance } from "../reference";
import { deriveSceneProductionBriefs } from "../plan";
import { decideProductionDispatch, PRODUCTION_ADAPTER_CONNECTED } from "../adapter";
import { composeExperienceProjection } from "../projection";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const MUX = "795c057e-2967-4e93-8f5e-06297c674cb0";
const PLAYBACK = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

assert(classifyLifecycleKind("universe") === "canonical", "Universe is canonical");
assert(classifyLifecycleKind("scene") === "canonical", "Scene is canonical");
assert(classifyLifecycleKind("frame_observation") === "evidence", "observations stay evidence");
assert(classifyLifecycleKind("storyboard") === "intelligence", "storyboard is derived intelligence");
assert(classifyLifecycleKind("curated_reference") === "reference", "human-selected stills are references");
assert(classifyLifecycleKind("production_plan") === "plan", "production plan is an instruction layer");
assert(classifyLifecycleKind("media_realization") === "realization", "media_realization stays the later realization layer");
assert(classifyLifecycleKind("holographic") === "projection", "2.5D is projection");
assert(classifyGalleryAssetRole({ provider: "mux", asset_type: "original", storage_ref: PLAYBACK }) === "source", "Mux original is a source");
assert(classifyGalleryAssetRole({ provider: "curated-reference", asset_type: "thumbnail", storage_ref: PLAYBACK }) === "reference", "curated still is a reference");
assert(classifyGalleryAssetRole({ provider: "production", asset_type: "preview", storage_ref: "job" }) === "production", "production provider is a production result");
assert(classifyGalleryAssetRole({ provider: "mux", asset_type: "thumbnail", storage_ref: "http://x" }) === "other", "artwork thumbnails are not source dumps");
assert(isGalleryProductionAsset("source") && isGalleryProductionAsset("reference"), "sources and references are usable production assets");
assert(!isGalleryProductionAsset("other"), "other is not a production catalogue role");
assert(galleryRoleLabel("reference") === "Reference", "reference label");

const retain = decideRetainReference({
  universe_id: UNIVERSE,
  source_asset_id: MUX,
  time_ms: 36000,
  role: "still",
  scene_master_id: POWERHOUSE,
  panel_id: `scene-${POWERHOUSE}`,
});
assert(retain.ok && retain.action === "retain_reference", "Powerhouse still can be retained");
assert(retain.integrity_hash === `curated-reference:${UNIVERSE}:${MUX}:36000:still`, "integrity hash is idempotent");
assert(
  retain.creates_scene === false &&
    retain.creates_universe === false &&
    retain.creates_creative_moment === false &&
    retain.binds_projection === false &&
    retain.creates_realization === false &&
    retain.canonicalises === false,
  "retain does not canonicalise",
);

const again = decideRetainReference({
  universe_id: UNIVERSE,
  source_asset_id: MUX,
  time_ms: 36000,
  role: "still",
  scene_master_id: POWERHOUSE,
});
assert(again.ok && again.integrity_hash === retain.integrity_hash, "same still is the same reference");

assert(!decideRetainReference({ source_asset_id: MUX, time_ms: 36000 }).ok, "universe is required");
assert(!decideRetainReference({ universe_id: UNIVERSE, source_asset_id: MUX, time_ms: -1 }).ok, "negative time is rejected");
assert(!decideRetainReference({ universe_id: UNIVERSE, source_asset_id: MUX, time_ms: 36000, role: "universe" }).ok, "cannot retain as a Universe");
assert(!decideRetainReference({ universe_id: "not-an-id", source_asset_id: MUX, time_ms: 0 }).ok, "invalid universe is rejected");

const parsed = parseReferenceProvenance(JSON.stringify({
  kind: "curated-reference",
  universe_id: UNIVERSE,
  source_asset_id: MUX,
  time_ms: 36000,
  role: "still",
  scene_master_id: POWERHOUSE,
  moment_master_id: PROVERB,
  panel_id: `scene-${POWERHOUSE}`,
  session_id: null,
}));
assert(parsed?.scene_master_id === POWERHOUSE && parsed.moment_master_id === PROVERB, "provenance round-trips Scene and Moment");
assert(parseReferenceProvenance("not-json") === null, "invalid provenance is ignored");

const assembly = {
  master_id: UNIVERSE,
  title: "Super Hero Ego",
  description: null,
  created_at: "2026-08-19T00:00:00Z",
  murals: [
    {
      master_id: MURAL,
      title: "Super Hero Ego",
      has_media: true,
      provider: "mux",
      storage_ref: PLAYBACK,
      scenes: [
        {
          master_id: POWERHOUSE,
          title: "Golden Shovel — Powerhouse",
          description: null,
          sort_order: 1,
          start_ms: 36000,
          end_ms: 79000,
          binding_id: null,
          projection_id: null,
          asset_id: MUX,
          creative_moments: [{ master_id: PROVERB, title: "Proverb" }],
          creative_moment_id: PROVERB,
          creative_moment_title: "Proverb",
          provider: "mux",
          storage_ref: PLAYBACK,
        },
        {
          master_id: HAND_TO_HAND,
          title: "ProVerb — Hand-to-Hand",
          description: null,
          sort_order: 3,
          start_ms: 149000,
          end_ms: 192000,
          binding_id: null,
          projection_id: null,
          asset_id: MUX,
          creative_moments: [{ master_id: PROVERB, title: "Proverb" }],
          creative_moment_id: PROVERB,
          creative_moment_title: "Proverb",
          provider: "mux",
          storage_ref: PLAYBACK,
        },
      ],
    },
  ],
  creative_moments: [],
};

const intelligence = {
  session_id: "session",
  asset_id: MUX,
  observation_count: 35,
  candidate_count: 8,
  proposals: [],
  storyboard: [
    { panel_id: `scene-${POWERHOUSE}`, kind: "scene", time_ms: 36000, scene_master_id: POWERHOUSE, title: "Powerhouse", still_url: null, change_score: null, is_canonical_scene: true },
    { panel_id: `beat-${POWERHOUSE}-50000`, kind: "beat", time_ms: 50000, scene_master_id: POWERHOUSE, title: "Powerhouse beat", still_url: null, change_score: 0.4, is_canonical_scene: false },
  ],
  animation: [
    { scene_master_id: POWERHOUSE, title: "Powerhouse", start_ms: 36000, end_ms: 79000, duration_ms: 43000, intensity: 0.3, enter: "cut", exit: "dissolve", motion: "power", holographic_depth: 48 },
  ],
  holographic: [{ layer_id: "scene-1", kind: "scene", master_id: POWERHOUSE, title: "Powerhouse", still_url: null, depth: 72, offset_x: 0, offset_y: 0, related_scene_ids: [POWERHOUSE] }],
  unaligned_beats: [],
  creates_universe: false,
  creates_mural: false,
  creates_scene: false,
  creates_creative_moment: false,
  creates_projection: false,
  creates_binding: false,
  creates_realization: false,
};

const briefs = deriveSceneProductionBriefs(assembly, intelligence, [
  {
    asset_id: "ref-1",
    title: "Powerhouse still",
    role: "still",
    time_ms: 36000,
    still_url: null,
    scene_master_id: POWERHOUSE,
    moment_master_id: PROVERB,
    source_asset_id: MUX,
    panel_id: `scene-${POWERHOUSE}`,
  },
]);
assert(briefs.length === 2, "one brief per canonical Scene");
assert(briefs[0].scene_master_id === POWERHOUSE, "Powerhouse is first");
assert(briefs[0].moments[0].title === "Proverb", "Proverb remains present in Powerhouse");
assert(briefs[0].references.length === 1, "retained still is attached to Powerhouse");
assert(briefs[0].realization === null && briefs[0].status === "planning", "no fake realization");
assert(briefs[0].provider_target === "unassigned", "MCP is not assigned");
assert(briefs[1].references.length === 0, "Hand-to-Hand does not inherit the Powerhouse still");
assert(briefs[0].window_label.includes("0:36.000"), "canonical timing stays on the brief");

const dispatch = decideProductionDispatch({ universe_id: UNIVERSE, brief: briefs[0] });
assert(!dispatch.ok && dispatch.code === "not_connected", "adapter refuses to pretend a provider ran");
assert(dispatch.creates_canonical === false && dispatch.populates_media_realization === false, "dispatch does not write realization");
assert(PRODUCTION_ADAPTER_CONNECTED === false, "no MCP provider is connected");
assert(decideProductionDispatch({}).code === "missing_plan", "empty dispatch is rejected");

const projected = composeExperienceProjection({
  canonical_layers: intelligence.holographic,
  realizations: [],
});
assert(projected.layers.length === 1, "empty realizations do not add 2.5D layers");
assert(projected.injects_gallery === false && projected.injects_evidence === false, "projection is not a Gallery dump");
assert(projected.redefines_timing === false, "production does not rewrite Scene windows");
assert(
  composeExperienceProjection({
    canonical_layers: intelligence.holographic,
    realizations: [{ layer_id: "fake", scene_master_id: POWERHOUSE, still_url: "https://example", approved: true }],
  }).layers.length === 1,
  "even an approved realization is not injected as a fake Moment object yet",
);

console.log("Production orchestration tests: all passed");

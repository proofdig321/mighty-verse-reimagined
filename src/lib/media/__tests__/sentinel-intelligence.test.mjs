import { composeSentinelIntelligence, decideAuthoriseWindows } from "../sentinel-intelligence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const DARK_KNIGHT = "bebb65d2-21ed-4bc9-9fa0-a4857df30a43";
const HAND_TO_HAND = "df15ec76-6bd8-4956-bbaa-755f72b2b8f8";
const SWORD_MASTER = "65490a92-8faf-42ea-a391-0e6473360f5c";
const PROVERB = "3b0de6b4-2ca0-43c0-8561-7dc1c0697435";
const MOTHIPA = "32422bb4-d03c-465d-8348-942e49ae0051";
const REASON = "2745a50a-5417-4613-b23b-ef4857ab112e";
const MUX = "795c057e-2967-4e93-8f5e-06297c674cb0";
const PLAYBACK = "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4";

const scenes = [
  {
    master_id: POWERHOUSE,
    title: "Golden Shovel — Powerhouse",
    binding_id: "6ca3869d-ca39-4422-bfd1-8b1353d64ea5",
    start_ms: 36000,
    end_ms: 79000,
    sort_order: 1,
    provider: "mux",
    storage_ref: PLAYBACK,
    asset_id: MUX,
    creative_moments: [{ master_id: PROVERB, title: "Proverb" }],
  },
  {
    master_id: DARK_KNIGHT,
    title: "Mothipa — Dark Knight",
    binding_id: "9b8fbc44-5d1b-438f-9e4f-13ffe51d95fb",
    start_ms: 80000,
    end_ms: 124000,
    sort_order: 2,
    provider: "mux",
    storage_ref: PLAYBACK,
    asset_id: MUX,
    creative_moments: [{ master_id: MOTHIPA, title: "Mothipa" }],
  },
  {
    master_id: HAND_TO_HAND,
    title: "ProVerb — Hand-to-Hand",
    binding_id: "1765324d-8f8a-42f2-93c3-a2a3fec1356e",
    start_ms: 149000,
    end_ms: 192000,
    sort_order: 3,
    provider: "mux",
    storage_ref: PLAYBACK,
    asset_id: MUX,
    creative_moments: [{ master_id: PROVERB, title: "Proverb" }],
  },
  {
    master_id: SWORD_MASTER,
    title: "Reason — Sword Master",
    binding_id: "44130ab6-2dd9-49f0-b2aa-756b91550ece",
    start_ms: 193000,
    end_ms: 254000,
    sort_order: 4,
    provider: "mux",
    storage_ref: PLAYBACK,
    asset_id: MUX,
    creative_moments: [{ master_id: REASON, title: "Reason" }],
  },
];

const observations = [
  { time_ms: 35000, mean_luminance: 40, change_score: 0.31, is_boundary_candidate: true },
  { time_ms: 50000, mean_luminance: 55, change_score: 0.12, is_boundary_candidate: false },
  { time_ms: 79000, mean_luminance: 60, change_score: 0.28, is_boundary_candidate: true },
  { time_ms: 81000, mean_luminance: 30, change_score: 0.33, is_boundary_candidate: true },
  { time_ms: 100000, mean_luminance: 22, change_score: 0.18, is_boundary_candidate: true },
  { time_ms: 124000, mean_luminance: 28, change_score: 0.21, is_boundary_candidate: true },
  { time_ms: 132000, mean_luminance: 18, change_score: 0.4, is_boundary_candidate: true },
  { time_ms: 149000, mean_luminance: 70, change_score: 0.26, is_boundary_candidate: true },
  { time_ms: 192000, mean_luminance: 66, change_score: 0.19, is_boundary_candidate: true },
  { time_ms: 193000, mean_luminance: 48, change_score: 0.24, is_boundary_candidate: true },
  { time_ms: 254000, mean_luminance: 44, change_score: 0.11, is_boundary_candidate: true },
];

const plan = composeSentinelIntelligence({
  session_id: "324eaa7b-ad00-4543-b934-bdc876f83c5a",
  asset_id: MUX,
  observations,
  scenes,
  moments: [
    { master_id: PROVERB, title: "Proverb", scene_ids: [POWERHOUSE, HAND_TO_HAND] },
    { master_id: MOTHIPA, title: "Mothipa", scene_ids: [DARK_KNIGHT] },
    { master_id: REASON, title: "Reason", scene_ids: [SWORD_MASTER] },
  ],
  mural: { master_id: MURAL, title: "Super Hero Ego", provider: "mux", storage_ref: PLAYBACK },
});

assert(plan.creates_scene === false && plan.creates_universe === false, "intelligence does not create canonical objects");
assert(plan.proposals.length === 4, "one proposal per Super Hero Ego Scene");
assert(plan.proposals.every((proposal) => proposal.creates_scene === false), "proposals never create Scenes");

const powerhouse = plan.proposals.find((proposal) => proposal.scene_master_id === POWERHOUSE);
assert(powerhouse.status === "adjust", "near-boundary Sentinel evidence proposes a Powerhouse adjustment");
assert(powerhouse.proposed_start_ms === 35000, "Powerhouse start snaps to nearest Sentinel candidate");
assert(powerhouse.canonical_start_ms === 36000, "canonical Powerhouse start remains 36s until authorised");

const alignedSword = plan.proposals.find((proposal) => proposal.scene_master_id === SWORD_MASTER);
assert(alignedSword.proposed_start_ms === 193000, "Sword Master start already matches Sentinel");

assert(plan.unaligned_beats.includes(132000), "an extra Sentinel candidate is a beat, not a Scene");
assert(plan.storyboard.some((panel) => panel.kind === "scene" && panel.scene_master_id === POWERHOUSE), "storyboard includes Powerhouse");
assert(plan.storyboard.some((panel) => panel.kind === "beat" && !panel.is_canonical_scene), "storyboard includes observational beats");
assert(plan.storyboard[0].still_url.includes("image.mux.com"), "storyboard stills use Mux");
assert(plan.animation.length === 4, "animation plan covers four Scenes");
assert(plan.animation[0].motion === "power", "Powerhouse motion language is power");
assert(plan.holographic.some((layer) => layer.kind === "mural"), "2.5D includes the Mural plane");
assert(plan.holographic.filter((layer) => layer.kind === "scene").length === 4, "2.5D includes four Scene planes");
assert(plan.holographic.filter((layer) => layer.kind === "moment").length === 3, "2.5D includes Creative Moments as spatial objects");
assert(plan.holographic.find((layer) => layer.master_id === PROVERB)?.related_scene_ids.length === 2, "Proverb remains shared in 2.5D");

const authorised = decideAuthoriseWindows({ universe_id: UNIVERSE, proposals: plan.proposals });
assert(authorised.ok && authorised.action === "authorise_windows", "curator can authorise Sentinel windows");
assert(authorised.creates_scene === false, "authorise does not create Scenes");
assert(authorised.windows.some((window) => window.scene_master_id === POWERHOUSE && window.start_ms === 35000), "authorise writes proposed Powerhouse window");
assert(!authorised.windows.some((window) => window.scene_master_id === SWORD_MASTER), "aligned Scenes are not rewritten");

const missing = decideAuthoriseWindows({ proposals: plan.proposals });
assert(!missing.ok && missing.code === "missing_ids", "authorise requires a Universe");

const none = decideAuthoriseWindows({
  universe_id: UNIVERSE,
  proposals: plan.proposals.map((proposal) => ({ ...proposal, status: "aligned" })),
});
assert(!none.ok && none.code === "nothing_to_authorise", "aligned evidence does not mutate windows");

const selected = decideAuthoriseWindows({
  universe_id: UNIVERSE,
  proposals: plan.proposals,
  scene_master_ids: [POWERHOUSE],
});
assert(selected.ok && selected.windows.length === 1 && selected.windows[0].scene_master_id === POWERHOUSE, "curator can authorise one Scene");

const canonicalOnly = composeSentinelIntelligence({
  asset_id: MUX,
  observations: [],
  scenes,
  moments: [
    { master_id: PROVERB, title: "Proverb", scene_ids: [POWERHOUSE, HAND_TO_HAND] },
    { master_id: MOTHIPA, title: "Mothipa", scene_ids: [DARK_KNIGHT] },
    { master_id: REASON, title: "Reason", scene_ids: [SWORD_MASTER] },
  ],
  mural: { master_id: MURAL, title: "Super Hero Ego", provider: "mux", storage_ref: PLAYBACK },
});
assert(canonicalOnly.proposals.every((proposal) => proposal.status === "aligned"), "public 2.5D without observations stays aligned to canonical windows");
assert(canonicalOnly.holographic.filter((layer) => layer.kind === "scene").length === 4, "canonical 2.5D still has four Scene planes");
assert(canonicalOnly.storyboard.filter((panel) => panel.kind === "scene").length === 4, "canonical storyboard still has four Scenes");
assert(canonicalOnly.creates_scene === false, "canonical-only intelligence still creates no Scenes");

console.log("Sentinel intelligence tests: all passed");

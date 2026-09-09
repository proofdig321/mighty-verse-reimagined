import { deriveProductionPath, productionPathInputFrom, productionStepStatusLabel } from "../workflow";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
const POWERHOUSE = "4790c7cf-bb19-4a01-a243-e5c3eb680555";
const SUITE = `/authority/universes/${UNIVERSE}`;

const sheReady = deriveProductionPath({
  suiteHref: SUITE,
  hasMural: true,
  hasSourceMedia: true,
  observationCount: 35,
  storyboardCount: 8,
  proposalCount: 4,
  adjustCount: 1,
  holographicCount: 8,
});

assert(sheReady.length === 7, "production path has seven stages");
assert(sheReady[0].id === "source" && sheReady[0].status === "ready", "source is ready when Mux media is bound");
assert(sheReady[1].id === "sentinel" && sheReady[1].status === "ready", "Sentinel is ready when observations exist");
assert(sheReady[2].href === `${SUITE}#sentinel-storyboard`, "storyboard jumps in-suite, not to a public route");
assert(sheReady[3].status === "attention" && sheReady[4].status === "attention", "adjust proposals need curator authorisation");
assert(sheReady[5].id === "preview" && sheReady[5].fragment === "universe-preview", "2.5D preview stays in Studio");
assert(sheReady[6].id === "experience" && sheReady[6].status === "ready", "Experience is the final continuation");
assert(productionStepStatusLabel("attention") === "Needs authorisation", "attention is curator work, not autonomous canon");

const aligned = deriveProductionPath({
  suiteHref: SUITE,
  hasMural: true,
  hasSourceMedia: true,
  observationCount: 35,
  storyboardCount: 4,
  proposalCount: 4,
  adjustCount: 0,
  holographicCount: 8,
});
assert(aligned.find((step) => step.id === "proposals")?.status === "canonical", "aligned windows are canonical, not proposals-to-apply");
assert(aligned.find((step) => step.id === "authorise")?.status === "canonical", "nothing to authorise when Sentinel matches canon");

const empty = deriveProductionPath({
  suiteHref: `/authority/universes/${MURAL}`,
  hasMural: false,
  hasSourceMedia: false,
  observationCount: 0,
  storyboardCount: 0,
  proposalCount: 0,
  adjustCount: 0,
  holographicCount: 0,
});
assert(empty.every((step) => step.status === "waiting" || step.id === "experience"), "empty Universe waits on source and Sentinel");

const fromAssembly = productionPathInputFrom(
  {
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
        storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
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
            asset_id: "795c057e-2967-4e93-8f5e-06297c674cb0",
            creative_moments: [],
            creative_moment_id: null,
            creative_moment_title: null,
            provider: "mux",
            storage_ref: "JHSfFnrz00ovBfPYcp44w85ueRr01XlqSXPgKYoVFgfN4",
          },
        ],
      },
    ],
    creative_moments: [],
  },
  {
    session_id: "session",
    asset_id: "795c057e-2967-4e93-8f5e-06297c674cb0",
    observation_count: 35,
    candidate_count: 8,
    proposals: [{ status: "aligned" }, { status: "adjust" }],
    storyboard: [{}, {}, {}],
    animation: [],
    holographic: [{}, {}],
    unaligned_beats: [],
    creates_universe: false,
    creates_mural: false,
    creates_scene: false,
    creates_creative_moment: false,
    creates_projection: false,
    creates_binding: false,
    creates_realization: false,
  },
  SUITE,
);
assert(fromAssembly.hasSourceMedia === true, "SHE Mux asset is source media");
assert(fromAssembly.adjustCount === 1, "live intelligence still reports curator work");

console.log("Assemble production path tests: all passed");

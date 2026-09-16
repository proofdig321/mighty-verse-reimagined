import { composeStudioLanding } from "../studio-landing";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SHE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
const FR = "e22e080c-715c-4045-ba82-20474d25b2e0";
const SHE_COPY = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";

const universes = [
  { master_id: SHE, title: "Super Hero Ego", description: "Canonical" },
  { master_id: SHE, title: "Super Hero Ego", description: "duplicate identity must collapse" },
  { master_id: FR, title: "Father Raymond", description: null },
];

const works = [
  { work_id: "w-standalone-a", title: "Judas", premise: "working artifact", updated_at: "2026-09-16T00:00:00Z", panel_count: 2, universe_id: null, attached: false, status: "draft", generation_status: "idle", selected_still: false, selected_motion: false, creates_scene: false },
  { work_id: "w-standalone-b", title: "Untitled storyboard", premise: null, updated_at: "2026-09-16T00:00:00Z", panel_count: 0, universe_id: null, attached: false, status: "draft", generation_status: "idle", selected_still: false, selected_motion: false, creates_scene: false },
  { work_id: "w-she-1", title: "SHE storyboard", premise: null, updated_at: "2026-09-16T00:00:00Z", panel_count: 4, universe_id: SHE, attached: true, status: "draft", generation_status: "idle", selected_still: true, selected_motion: false, creates_scene: false },
  { work_id: "w-she-2", title: "SHE storyboard copy", premise: null, updated_at: "2026-09-16T00:00:00Z", panel_count: 1, universe_id: SHE, attached: true, status: "draft", generation_status: "idle", selected_still: false, selected_motion: false, creates_scene: false },
];

const landing = composeStudioLanding(universes, works);
assert(landing.universes.length === 2, "each Universe identity appears once");
const sheCard = landing.universes.find((card) => card.master_id === SHE);
assert(sheCard && sheCard.attached_work_count === 2, "attached work is counted on Super Hero Ego, not duplicated as Universe cards");
assert(sheCard.href === `/authority/universes/${SHE_COPY}`, "Universe card opens the existing Studio workspace");
assert(sheCard.withdrawable === false, "missing withdrawable stays false so Super Hero Ego is not treated as removable");

const orphanFirst = composeStudioLanding(
  [
    { master_id: SHE, title: "Super Hero Ego", description: null, occupancy: "curated", withdrawable: false },
    { master_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Untitled universe", description: null, occupancy: "orphan", withdrawable: true },
  ],
  [],
);
assert(orphanFirst.universes[0].occupancy === "orphan", "orphan shells surface first so they can be edited or removed");
assert(orphanFirst.universes[1].master_id === SHE, "curated Super Hero Ego stays listed after orphans");
assert(landing.universes.every((card) => card.kind === "universe"), "Universe cards stay Universes");
assert(landing.standalone.length === 2, "standalone work is listed by work_id");
assert(landing.standalone.every((card) => card.work.universe_id === null), "attached work is not a standalone card");
assert(new Set(landing.standalone.map((card) => card.work.work_id)).size === 2, "standalone duplicates are real work rows, not filtered by title");

const sameTitleUniverses = composeStudioLanding(
  [
    { master_id: SHE, title: "Super Hero Ego", description: null },
    { master_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Super Hero Ego", description: "different record" },
  ],
  [],
);
assert(sameTitleUniverses.universes.length === 2, "same title with different master_id is not hidden");

console.log("Studio landing identity tests: all passed");

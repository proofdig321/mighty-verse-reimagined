import {
  cloneSnapshot,
  emptyHistory,
  parseHistory,
  pushHistory,
  redoHistory,
  saveStatusLabel,
  snapshotsEqual,
  undoHistory,
  workToSnapshot,
} from "../history";
import { applyOrder, duplicatePanel, movePanelIds, removePanel, resetScopeCopy } from "../mutations";
import { derivePanelUiStatus, motionRequirement, panelUiLabel } from "../panel-state";
import { formatTimestamp, parseStoryboardFrame, parseStoryboardSource, sourceCategoryLabel } from "../source";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const snapshot = workToSnapshot({
  title: "Test",
  body: "A walker crosses the mural.",
  premise: null,
  panels: [{
    panel_id: "p1",
    sequence: 1,
    title: "Open",
    description: "Night street",
    narrative_purpose: null,
    action: "walks",
    dialogue: null,
    narration: null,
    camera: "crane",
    camera_movement: "rise",
    framing: null,
    lens_style: null,
    lighting: null,
    environment: null,
    characters: null,
    mood: null,
    transition: "cut",
    duration_ms: 4000,
    aspect_ratio: "16:9",
    status: "draft",
    active_still_asset_id: null,
    active_motion_asset_id: null,
    still_url: null,
    motion_playback_id: null,
    motion_endpoint: null,
    references: [],
    user_locked: false,
  }],
  assembly: [],
});

const edited = { ...snapshot, body: "A walker stops." };
let history = pushHistory(emptyHistory(), {
  id: "1",
  label: "Edit story",
  kind: "authoring",
  reversible: true,
  persistent: true,
  undoHint: "Undo story edit",
  before: cloneSnapshot(snapshot),
  after: cloneSnapshot(edited),
});
assert(history.past.length === 1, "edit is recorded");
const undone = undoHistory(history);
assert(undone?.entry.before.body === snapshot.body, "undo restores authored text");
history = undone.state;
const redone = redoHistory(history);
assert(redone?.entry.after.body === edited.body, "redo reapplies authored text");
assert(undoHistory({ past: [{ ...history.past[0], reversible: false, kind: "generation" }], future: [] }) === null, "provider generation is not magically undone");
assert(saveStatusLabel({ dirty: true, saving: false, failed: false }) === "Unsaved changes", "save state is explicit");
assert(saveStatusLabel({ dirty: false, saving: true, failed: false }) === "Saving…", "saving is visible");
assert(parseHistory(null).past.length === 0, "empty history parses");
assert(snapshotsEqual(snapshot, cloneSnapshot(snapshot)), "snapshots clone");

const panels = [
  { panel_id: "a", sequence: 1, title: "A", description: "" },
  { panel_id: "b", sequence: 2, title: "B", description: "" },
];
assert(applyOrder(panels, ["b", "a"])[0].panel_id === "b", "reorder is persistent-shaped");
assert(removePanel(panels, "a").length === 1, "delete removes the panel");
assert(duplicatePanel(panels[0], "c", 3).title === "A copy", "duplicate copies");
assert(movePanelIds(["a", "b", "c"], 0, 2).join("") === "bca", "move ids");
assert(resetScopeCopy("unsaved").destructive === false, "unsaved reset is the safe default");
assert(resetScopeCopy("saved").destructive === false, "saved reset reloads persisted work");
assert(resetScopeCopy("panel-artifacts").destructive === true, "artifact reset is explained as destructive");
assert(resetScopeCopy("initial").destructive === true, "initial reset is destructive and explained");

assert(derivePanelUiStatus({ selected: false, persistedStatus: "draft" }) === "draft", "empty panel is draft");
assert(derivePanelUiStatus({ selected: true, stillUrl: "https://example/still.png", jobs: [] }) === "selected", "selected artifact is selected");
assert(derivePanelUiStatus({ selected: false, jobs: [{ panel_id: "p", status: "processing" }] }) === "generating", "running job is generating");
assert(derivePanelUiStatus({ selected: false, jobs: [{ panel_id: "p", status: "failed" }] }) === "failed", "failed job without artifact is failed");
assert(panelUiLabel("generated") === "Generated", "generated label");
assert(motionRequirement({ kind: "animate-still" }).available === false, "image-to-video needs a still");
assert(motionRequirement({ kind: "reference-motion", referenceUrls: [] }).reason?.includes("reference image"), "reference motion explains missing images");
assert(motionRequirement({ kind: "extend" }).reason?.includes("generated video"), "extend explains missing video");

const source = parseStoryboardSource(JSON.stringify({
  kind: "storyboard-source",
  work_id: "w1",
  title: "Super Hero Ego SABC1 Performance",
  playback_id: "abc",
  category: "source",
}));
const untitled = parseStoryboardSource(JSON.stringify({
  kind: "storyboard-source",
  work_id: "w1",
}));
assert(untitled?.title === "Source media", "missing title is not a broadcast label");
assert(untitled?.creates_scene === false, "untitled source is not a Scene");
assert(sourceCategoryLabel("source") === "Source", "source stays source");
assert(formatTimestamp(90000) === "01:30", "timestamp is HH:MM or MM:SS");
const frame = parseStoryboardFrame(JSON.stringify({
  kind: "storyboard-frame-reference",
  work_id: "w1",
  source_title: "Super Hero Ego SABC1 Performance",
  timestamp_ms: 90000,
  playback_id: "abc",
  still_url: "https://image.mux.com/abc/thumbnail.jpg?time=90",
}));
assert(frame?.derived === "Storyboard Reference", "frame provenance is derived reference");
assert(frame?.creates_canonical === false, "derived frame is not canonical");

console.log("Storyboard mutation tests: all passed");

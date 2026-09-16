import {
  isStoryboardOwnedIntake,
  storyboardAssemblyNotes,
  storyboardCinematicNotes,
  storyboardFrameNotes,
  storyboardProvenanceWorkId,
  storyboardSelectionNotes,
  storyboardSourceNotes,
} from "../source";
import { composeFallbackCinematic } from "../../media/cinematic-evidence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const WORK = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const source = storyboardSourceNotes({
  work_id: WORK,
  title: "Judas",
  asset_id: "asset",
  mux_asset_id: "mux",
  playback_id: "play",
  endpoint_ref: null,
  still_url: null,
  duration_ms: 1000,
  category: "source",
});
const frame = storyboardFrameNotes({
  work_id: WORK,
  source_title: "Judas",
  timestamp_ms: 0,
  playback_id: "play",
  still_url: "https://image.mux.com/play/thumbnail.jpg",
  panel_id: null,
});
const assembly = storyboardAssemblyNotes({ work_id: WORK, items: [] });
const selection = storyboardSelectionNotes({ work_id: WORK, shot_id: "shot-1", panel_id: null });
const cinematic = storyboardCinematicNotes({
  work_id: WORK,
  cinematic: composeFallbackCinematic({
    playbackId: "play",
    assetId: null,
    durationMs: 8_000,
    cues: [{ time_ms: 1000, mean_luminance: 40, change_score: 0.2, is_boundary_candidate: true }],
    limitation: "test",
  }),
});

assert(storyboardProvenanceWorkId(source) === WORK, "source intake belongs to the work");
assert(isStoryboardOwnedIntake(frame, WORK) === true, "frame intake is work-owned");
assert(isStoryboardOwnedIntake(assembly, WORK) === true, "assembly intake is work-owned");
assert(isStoryboardOwnedIntake(selection, WORK) === true, "selection intake is work-owned");
assert(isStoryboardOwnedIntake(cinematic, WORK) === true, "cinematic intake is work-owned");
assert(isStoryboardOwnedIntake(source, OTHER) === false, "another work does not own this intake");
assert(isStoryboardOwnedIntake('{"kind":"storyboard-body","universe_id":"05ccc0c6-75f9-4864-b0c1-af5e36bf45cc"}', WORK) === false, "legacy story body is not deleted as work-owned intake");
assert(isStoryboardOwnedIntake('{"kind":"production-result"}', WORK) === false, "canonical production provenance is not a storyboard workspace artifact");

console.log("Storyboard workspace lifecycle tests: all passed");

import { operatorGenerationMessage } from "../operator-error";
import { parseStoryboardCinematic, parseStoryboardSelection, STORYBOARD_CINEMATIC_KIND, STORYBOARD_SELECTION_KIND, storyboardCinematicNotes, storyboardSelectionNotes } from "../source";
import { CINEMATIC_KIND } from "../../media/cinematic-evidence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ffmpeg = operatorGenerationMessage("Failed · spawn ffmpeg ENOENT");
assert(ffmpeg.operator === "Generation failed while preparing the source media.", "ffmpeg ENOENT is operator-facing");
assert(ffmpeg.technical.includes("ffmpeg"), "technical detail is retained");
assert(operatorGenerationMessage("quota exceeded").operator.includes("quota"), "quota errors stay honest");

const cinematic = {
  kind: CINEMATIC_KIND,
  analysis_version: "cinematic-v1",
  analysis_mode: "sampled-fallback",
  provider_limitation: "test",
  overview: "Fallback storyline.",
  playback_id: "hqGacPkUZZuWiTu4kl9DZQx56IutFzfnXnsgDr1LHEM",
  asset_id: null,
  duration_ms: 1000,
  shots: [{
    shot_id: "shot-0",
    sequence: 1,
    start_ms: 0,
    end_ms: 1000,
    duration_ms: 1000,
    time_ms: 500,
    still_url: null,
    framing: "unknown",
    composition: null,
    camera: "unknown",
    camera_explanation: "unknown",
    subjects: [],
    motion: "Hold",
    action: "unknown",
    environment: "unknown",
    lighting: null,
    transition: "unknown",
    narrative: null,
    what_happens: "Hold.",
    confidence: "low",
    analysis_mode: "sampled-fallback",
    creates_scene: false,
  }],
  creates_scene: false,
  creates_canonical: false,
};

const notes = storyboardCinematicNotes({ work_id: "work-1", cinematic });
const parsed = parseStoryboardCinematic(notes);
assert(parsed?.kind === STORYBOARD_CINEMATIC_KIND, "cinematic analysis reuses media_intake provenance");
assert(parsed.creates_scene === false, "persisted analysis is not a Scene");
assert(parsed.cinematic.shots.length === 1, "shots survive provenance roundtrip");

const selection = parseStoryboardSelection(storyboardSelectionNotes({
  work_id: "work-1",
  shot_id: "shot-0",
  panel_id: "panel-1",
}));
assert(selection?.kind === STORYBOARD_SELECTION_KIND, "selection is durable application state");
assert(selection.panel_id === "panel-1", "selection stores the active panel");

function referenceKey(playbackId, timeMs) {
  return `${playbackId ?? "none"}:${Math.round(timeMs)}`;
}

assert(referenceKey("abc", 12600) === referenceKey("abc", 12600.4), "duplicate references collapse on playback+time");
assert(referenceKey("abc", 12600) !== referenceKey("abc", 18000), "different times are distinct references");

console.log("Sentinel binding / operator error tests: all passed");

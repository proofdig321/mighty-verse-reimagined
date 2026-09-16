import { composeStoryboardBody, panelsFromStoryBody } from "../script";
import { parseStoryboardBody, parseStoryboardArtifact, storyboardArtifactNotes, storyboardBodyNotes, STORYBOARD_BODY_KIND } from "../artifact";
import { assistAction, assistReplacesStory } from "../assist";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const script = `Golden Shovel walks a futuristic Johannesburg skyline.
Camera: rise through the mural
The city transforms around him.
Movement: slow orbit
Spirit avatar appears.
Transition: cut`;

const composed = composeStoryboardBody(script);
assert(composed.creates_scene === false && composed.creates_canonical === false, "script composition is not canonical");
assert(composed.panels.length === 3, "direction lines do not become extra panels");
assert(composed.panels[0].camera === "rise through the mural", "camera direction attaches to the preceding beat");
assert(composed.panels[1].movement === "slow orbit", "movement attaches to the preceding beat");
assert(composed.panels[2].transition === "cut", "transition attaches to the preceding beat");
assert(panelsFromStoryBody("").length === 0, "empty story body has no panels");

const notes = storyboardBodyNotes({
  universe_id: "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc",
  body: composed.body,
  panel_count: composed.panels.length,
});
const parsed = parseStoryboardBody(notes);
assert(parsed?.kind === STORYBOARD_BODY_KIND, "story body reuses media_intake provenance");
assert(parsed.creates_scene === false, "saved story body does not create Scenes");
assert(parseStoryboardArtifact(notes) === null, "story body is not a generated media artifact");
assert(parseStoryboardBody('{"kind":"production-result"}') === null, "production provenance is not a storyboard body");

const muxNotes = storyboardArtifactNotes({
  universe_id: "",
  output_type: "clip",
  panel_id: "panel-1",
  title: "Motion",
  description: "Veo prompt",
  source: "ai",
  mux_asset_id: "mux-asset-id",
  playback_id: "playback-id",
  still_url: "https://image.mux.com/playback-id/thumbnail.jpg",
});
const muxArtifact = parseStoryboardArtifact(muxNotes);
assert(muxArtifact?.creates_scene === false && muxArtifact.creates_canonical === false, "Mux handoff is not a Scene");
assert(muxArtifact.binds_projection === false, "generated Mux media does not bind a projection");
assert(muxArtifact.playback_id === "playback-id" && muxArtifact.mux_asset_id === "mux-asset-id", "Mux ids stay on the artifact");
assert(assistAction("create-storyboard")?.label === "Create storyboard", "AI Assist has contextual create-storyboard");
assert(assistAction("invent-scene") === null, "AI Assist has no create-scene action");
assert(assistReplacesStory("expand") === true, "expand may replace the story after curator action");
assert(assistReplacesStory("rewrite-panel") === false, "panel rewrite is a suggestion, not a silent overwrite");
assert(assistReplacesStory("suggest-camera") === false, "camera suggestion does not replace the story");
assert(composed.creates_scene === false, "authored panels remain non-canonical");

console.log("Storyboard tests: all passed");

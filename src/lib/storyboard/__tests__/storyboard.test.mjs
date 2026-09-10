import { composeStoryboardBody, panelsFromStoryBody } from "../script";
import { parseStoryboardBody, parseStoryboardArtifact, storyboardBodyNotes, STORYBOARD_BODY_KIND } from "../artifact";

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

console.log("Storyboard tests: all passed");

import { deriveStoryboardProgress } from "../storyboard-progress";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const empty = deriveStoryboardProgress({});
assert(empty.completeCount === 0 && empty.total === 4, "empty storyboard has four waiting stages");
assert(empty.steps.every((step) => step.complete === false), "no fake percentages on an empty workspace");

const scriptOnly = deriveStoryboardProgress({ script: "SCENE 1: EXT. STREET", panelCount: 0 });
assert(scriptOnly.steps[0].complete === true && scriptOnly.completeCount === 1, "story body is live when text exists");

const pictured = deriveStoryboardProgress({
  script: "SCENE 1",
  panelCount: 3,
  referenceStillCount: 2,
  artifactTypes: ["panel"],
});
assert(pictured.completeCount === 3, "panels and gallery stills complete without inventing motion");
assert(pictured.steps.find((step) => step.id === "motion")?.complete === false, "motion waits for animation/clip/reel/gif");

const motion = deriveStoryboardProgress({
  script: "SCENE 1",
  panelCount: 1,
  artifactStillCount: 1,
  artifactTypes: ["animation"],
});
assert(motion.completeCount === 4, "animation from gallery stills completes the storyboard path");

console.log("Assemble storyboard progress tests: all passed");

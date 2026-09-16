import { deriveStoryboardProgress } from "../storyboard-progress";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const empty = deriveStoryboardProgress({});
assert(empty.completeCount === 0 && empty.total === 6, "empty storyboard has six waiting stages");
assert(empty.steps.every((step) => step.complete === false), "no fake percentages on an empty workspace");

const scriptOnly = deriveStoryboardProgress({ script: "SCENE 1: EXT. STREET", panelCount: 0 });
assert(scriptOnly.steps[0].complete === true && scriptOnly.completeCount === 1, "story body is live when text exists");

const pictured = deriveStoryboardProgress({
  script: "SCENE 1",
  panelCount: 3,
  referenceStillCount: 2,
  artifactTypes: ["still"],
});
assert(pictured.completeCount === 4, "script, panels, references, stills without inventing motion");
assert(pictured.steps.find((step) => step.id === "motion")?.complete === false, "motion waits for generated video");
assert(pictured.steps.find((step) => step.id === "assembly")?.complete === false, "assembly waits for gif/reel");

const motion = deriveStoryboardProgress({
  script: "SCENE 1",
  panelCount: 1,
  artifactStillCount: 1,
  artifactTypes: ["animation"],
});
assert(motion.steps.find((step) => step.id === "motion")?.complete === true, "animation completes motion");
assert(motion.steps.find((step) => step.id === "assembly")?.complete === false, "animation is not assembly");

const assembled = deriveStoryboardProgress({
  script: "SCENE 1",
  panelCount: 3,
  referenceStillCount: 1,
  artifactStillCount: 3,
  artifactTypes: ["still", "motion", "reel"],
});
assert(assembled.completeCount === 6, "reel completes assembly");

console.log("Assemble storyboard progress tests: all passed");

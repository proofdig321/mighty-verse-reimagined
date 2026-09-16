import { motionGenerationReady, primaryMotionKind, stillGenerationReady } from "../panel-state";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(stillGenerationReady({ panelSelected: false }).available === false, "still needs an active panel");
assert(
  stillGenerationReady({ panelSelected: true, hasObservation: false, hasReference: false, hasDirective: true }).reason.includes("reference"),
  "still needs Sentinel observation or a reference",
);
assert(
  stillGenerationReady({ panelSelected: true, hasObservation: true, hasReference: false, hasDirective: false }).reason.includes("directive"),
  "still needs a creator directive",
);
assert(
  stillGenerationReady({ panelSelected: true, hasObservation: true, hasReference: true, hasDirective: true }).available === true,
  "source + observation + reference + directive can generate a still",
);

assert(primaryMotionKind({ stillUrl: "https://image.mux.com/a/thumbnail.jpg" }) === "animate-still", "motion prefers the selected still");
assert(primaryMotionKind({ stillUrl: null }) === "motion", "without a still, motion is text-directed");
assert(motionGenerationReady({ stillUrl: null, hasDirective: false, hasReference: false }).available === false, "motion is gated without still, directive, or reference");
assert(motionGenerationReady({ stillUrl: "https://example.com/still.png" }).available === true, "a still is enough to generate motion");

console.log("Storyboard panel generation-gate tests: all passed");

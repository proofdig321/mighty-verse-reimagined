import {
  storyboardAssociationStatus,
  storyboardGenerationStatusLabel,
  storyboardUpdatedLabel,
  storyboardWorkSummary,
} from "../association";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const detached = storyboardAssociationStatus(null);
assert(detached.label === "Standalone work", "standalone state is labeled correctly");
assert(detached.required === true, "standalone state still requires explicit association");

const generation = storyboardGenerationStatusLabel("generating");
assert(generation === "Generating", "running generation should show a readable status");

const updated = storyboardUpdatedLabel("2026-10-02T00:00:00.000Z");
assert(updated.includes("Updated") || updated.includes("just now"), "updated label should be readable");

const summary = storyboardWorkSummary({
  universeId: null,
  generationStatus: "ready",
  updatedAt: "2026-10-02T00:00:00.000Z",
  panelCount: 3,
});
assert(summary.status === "Standalone work", "summary preserves standalone semantics");
assert(summary.line.includes("3 panels"), "summary line includes panel count");
assert(summary.line.includes("Ready"), "summary line includes generation status");

console.log("Storyboard status semantics tests: all passed");

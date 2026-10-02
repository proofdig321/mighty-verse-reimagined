import {
  storyboardAssociationStatus,
  storyboardAttachmentHint,
  storyboardGenerationStatusLabel,
  storyboardModeLabel,
  storyboardStatusTone,
  storyboardUpdatedLabel,
  storyboardWorkSummary,
} from "../association";
import {
  buildStoryboardShotIds,
  deriveStoryboardSequenceState,
} from "../workspace-state";
import {
  buildStoryboardReferenceAttachmentBody,
  resolveStoryboardAttachmentTarget,
} from "../attachments";

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

const mode = storyboardModeLabel(false);
assert(mode === "Standalone", "standalone mode label is user-readable");

const tone = storyboardStatusTone("blocked");
assert(tone === "warning", "blocked generation should reflect caution status");

const hint = storyboardAttachmentHint(null);
assert(hint.includes("attach"), "standalone work should recommend attachment");

const summary = storyboardWorkSummary({
  universeId: null,
  generationStatus: "ready",
  updatedAt: "2026-10-02T00:00:00.000Z",
  panelCount: 3,
});
assert(summary.status === "Standalone work", "summary preserves standalone semantics");
assert(summary.line.includes("3 panels"), "summary line includes panel count");
assert(summary.line.includes("Ready"), "summary line includes generation status");

const sequence = deriveStoryboardSequenceState({
  persistedPanels: [{ panel_id: "p1", references: [] }],
  scriptPanels: [{ panel_id: "s1" }],
  sentinelPanels: [],
  scenes: [{ master_id: "scene-1", title: "Scene 1" }],
});
assert(sequence.creativeCount === 2, "sequence count includes persisted and script panels");
assert(sequence.sequenceEmpty === false, "sequence is not empty when there is content");

const shotIds = buildStoryboardShotIds({
  persistedPanels: [{ panel_id: "p1" }],
  scriptPanels: [{ panel_id: "s1" }],
  sentinelPanels: [{ panel_id: "p1" }, { panel_id: "sn1" }],
  scenes: [{ master_id: "scene-1" }],
  fallbackSceneIds: ["scene-1"],
});
assert(shotIds.includes("p1"), "shot ids preserve persisted ids");
assert(shotIds.includes("sn1"), "shot ids include sentinel ids");
assert(!shotIds.includes("scene-1"), "non-empty sequences do not fall back to scenes");

const emptyShotIds = buildStoryboardShotIds({
  persistedPanels: [],
  scriptPanels: [],
  sentinelPanels: [],
  scenes: [{ master_id: "scene-1" }],
  fallbackSceneIds: ["scene-1"],
});
assert(emptyShotIds.includes("scene-1"), "shot ids fall back to scene ids when sequence is empty");

const attachmentTarget = resolveStoryboardAttachmentTarget({
  work: { panels: [{ panel_id: "panel-1" }, { panel_id: "panel-2" }] },
  selectedId: "panel-2",
});
assert(attachmentTarget.persistedId === "panel-2", "attachment target resolves to the selected persisted panel");

const attachmentBody = buildStoryboardReferenceAttachmentBody({
  universeId: "universe-1",
  workId: "work-1",
  panelId: "panel-2",
  assetId: "asset-42",
  stillUrl: "https://example.com/still.jpg",
  title: "Reference title",
  timeMs: 1200,
});
assert(attachmentBody.action === "use-still", "attachment payload uses the still workflow");
assert(attachmentBody.panel_id === "panel-2", "attachment payload keeps the selected panel");

console.log("Storyboard status semantics tests: all passed");

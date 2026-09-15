import { decideUrlIngestIntake, defaultUrlIngestWorkType } from "../gallery-intake";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requested = decideUrlIngestIntake({
  requestedIntakeId: "existing-intake",
  matchingUnlinkedIntakeId: "duplicate-intake",
});
assert(requested.mode === "requested" && requested.intakeId === "existing-intake", "explicit intake_id wins");

const reuse = decideUrlIngestIntake({
  requestedIntakeId: null,
  matchingUnlinkedIntakeId: "duplicate-intake",
});
assert(reuse.mode === "reuse" && reuse.intakeId === "duplicate-intake", "same YouTube URL reuses the unlinked shell");

const create = decideUrlIngestIntake({ requestedIntakeId: "  ", matchingUnlinkedIntakeId: null });
assert(create.mode === "create", "new YouTube ingest creates a Gallery intake");

assert(defaultUrlIngestWorkType("youtube") === "video", "YouTube ingest is video");
assert(defaultUrlIngestWorkType("direct") === "video", "direct HTTPS ingest is video");

console.log("gallery-intake.test.mjs: ok");

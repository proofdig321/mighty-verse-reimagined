import {
  classifyPollBudget,
  classifyProcessingPhase,
  classifyUrlIngestStage,
  REQUEST_TIMEOUT_COPY,
  urlIngestStageIndex,
  urlIngestStageLabel,
} from "../processing-state";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(classifyProcessingPhase("ingested") === "ingested", "ingested is complete");
assert(classifyProcessingPhase("ready") === "ingested", "legacy ready maps to ingested");
assert(classifyProcessingPhase("failed") === "failed", "failed is provider failure");
assert(classifyProcessingPhase("created") === "in_progress", "created is still in progress");
assert(classifyProcessingPhase("processing") === "in_progress", "processing is in progress");

assert(classifyPollBudget({ phase: "processing", attempt: 59, maxAttempts: 60 }) === "continue", "under budget continues");
assert(
  classifyPollBudget({ phase: "processing", attempt: 60, maxAttempts: 60 }) === "request_timeout",
  "poll budget exhausted is a request timeout, not failure",
);
assert(classifyPollBudget({ phase: "failed", attempt: 3, maxAttempts: 60 }) === "failed", "provider failed wins over budget");
assert(classifyPollBudget({ phase: "ingested", attempt: 60, maxAttempts: 60 }) === "ingested", "ingested wins over budget");

assert(
  REQUEST_TIMEOUT_COPY.includes("not a processing failure"),
  "timeout copy distinguishes request timeout from processing failure",
);

assert(classifyUrlIngestStage({ phase: "created" }) === "submitted", "created URL ingest is submitted");
assert(classifyUrlIngestStage({ phase: "processing" }) === "pulling", "processing URL ingest is Mux pulling");
assert(
  classifyUrlIngestStage({ phase: "processing", providerStatus: "preparing" }) === "pulling",
  "Mux preparing is pulling, not a percentage",
);
assert(classifyUrlIngestStage({ phase: "ingested" }) === "ready", "ingested URL ingest is playable");
assert(classifyUrlIngestStage({ phase: "failed" }) === "failed", "failed URL ingest is failed");
assert(urlIngestStageIndex("submitted") === 0, "submitted is step 1 of 3");
assert(urlIngestStageIndex("pulling") === 1, "pulling is step 2 of 3");
assert(urlIngestStageIndex("ready") === 2, "ready is step 3 of 3");
assert(urlIngestStageLabel("pulling").includes("pulling"), "pulling copy names Mux pull");
assert(!urlIngestStageLabel("pulling").includes("%"), "URL ingest labels are not fake percentages");

console.log("processing-state.test.mjs: ok");

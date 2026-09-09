import {
  classifyPollBudget,
  classifyProcessingPhase,
  REQUEST_TIMEOUT_COPY,
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

console.log("processing-state.test.mjs: ok");

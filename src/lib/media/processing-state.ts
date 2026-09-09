/**
 * Media processing UI state.
 *
 * Browser poll budgets are request timeouts, not provider failures.
 * Canonical registration is independent of upload completion.
 * No fake percentage — only XHR upload progress is numeric.
 */

export const PROCESSING_POLL_MS = 5000;
export const PROCESSING_POLL_ATTEMPTS = 60;

export type ProcessingPhase =
  | "created"
  | "uploading"
  | "processing"
  | "ready"
  | "ingested"
  | "failed";

export type ProcessingKind = "ingested" | "failed" | "in_progress";

export type PollBudgetOutcome = "ingested" | "failed" | "continue" | "request_timeout";

export function classifyProcessingPhase(phase: string | null | undefined): ProcessingKind {
  if (phase === "ingested" || phase === "ready") return "ingested";
  if (phase === "failed") return "failed";
  return "in_progress";
}

export function classifyPollBudget(input: {
  phase: string | null | undefined;
  attempt: number;
  maxAttempts?: number;
}): PollBudgetOutcome {
  const kind = classifyProcessingPhase(input.phase);
  if (kind === "ingested") return "ingested";
  if (kind === "failed") return "failed";
  const max = input.maxAttempts ?? PROCESSING_POLL_ATTEMPTS;
  if (input.attempt >= max) return "request_timeout";
  return "continue";
}

export function processingStageLabel(kind: ProcessingKind, phase?: string | null): string {
  if (kind === "ingested") return "Ready to attach";
  if (kind === "failed") return "Processing failed";
  if (phase === "uploading" || phase === "created") return "Uploading";
  if (phase === "processing") return "Processing video…";
  return "Processing video…";
}

/** Honest copy when the browser stops waiting while the job may still run. */
export const REQUEST_TIMEOUT_COPY =
  "This page stopped waiting. Video processing may still be running. A request timeout is not a processing failure. You can leave and return to this work.";

export const PROCESSING_FAILED_COPY =
  "The media provider reported that processing failed. The canonical work is preserved. Retry the upload against this work — do not create a new Universe.";

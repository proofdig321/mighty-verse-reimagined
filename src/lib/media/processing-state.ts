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

/**
 * YouTube / HTTPS URL ingest stages.
 * Mux does not report a byte percentage for URL pull. These are labeled
 * operator stages, not a fake 0–100 bar.
 */
export const URL_INGEST_STAGES = [
  { id: "submitted", label: "Submitted ingest" },
  { id: "pulling", label: "Fetching the file into Mux" },
  { id: "ready", label: "Playable in Incoming and Gallery" },
] as const;

export type UrlIngestStage = (typeof URL_INGEST_STAGES)[number]["id"] | "failed";

export function classifyUrlIngestStage(input: {
  phase?: string | null;
  providerStatus?: string | null;
  outcome?: string | null;
}): UrlIngestStage {
  const phase = input.phase ?? "";
  const outcome = input.outcome ?? "";
  const provider = (input.providerStatus ?? "").toLowerCase();
  if (phase === "failed" || outcome === "failed" || provider === "errored") return "failed";
  if (
    phase === "ingested" ||
    phase === "ready" ||
    outcome === "ingested"
  ) {
    return "ready";
  }
  if (phase === "processing" || provider === "preparing" || provider === "asset_created") {
    return "pulling";
  }
  if (phase === "uploading") return "pulling";
  return "submitted";
}

export function urlIngestStageIndex(stage: UrlIngestStage): number {
  if (stage === "failed") return 1;
  if (stage === "submitted") return 0;
  if (stage === "pulling") return 1;
  return 2;
}

export function urlIngestStageLabel(stage: UrlIngestStage): string {
  if (stage === "failed") return "Could not ingest this video";
  if (stage === "submitted") return "Submitted ingest";
  if (stage === "pulling") return "Fetching the file into Mux";
  return "Playable in Incoming and Gallery";
}

/** Honest copy when the browser stops waiting while the job may still run. */
export const REQUEST_TIMEOUT_COPY =
  "This page stopped waiting. Video processing may still be running. A request timeout is not a processing failure. You can leave and return to this work.";

export const PROCESSING_FAILED_COPY =
  "The media provider reported that processing failed. The canonical work is preserved. Retry the upload against this work — do not create a new Universe.";

/** Curate / Add Media URL ingest. No Universe is involved. Operator finishes on Gallery. */
export const URL_INGEST_FAILED_COPY =
  "The file did not become playable in Mux. The intake stays in Gallery. Upload the file there, retry with a signed-in YouTube session, or delete the shell. This did not create a Universe.";

export const URL_INGEST_TIMEOUT_COPY =
  "This page stopped waiting. Mux may still be processing the file. A request timeout is not a processing failure. Check Incoming and Gallery. This did not create a Universe.";

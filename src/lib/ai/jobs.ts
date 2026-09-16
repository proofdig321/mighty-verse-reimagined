/**
 * Generation job state machine.
 * Jobs are persisted; progress is never a fake timer.
 */

export const GENERATION_JOB_STATUSES = [
  "queued",
  "submitted",
  "processing",
  "completed",
  "failed",
  "blocked",
  "cancelled",
  "needs_configuration",
  "unavailable",
] as const;

export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export type GenerationJobKind =
  | "text"
  | "structured-storyboard"
  | "still"
  | "motion"
  | "animate-still"
  | "first-last-frame"
  | "reference-motion"
  | "extend"
  | "gif"
  | "reel"
  | "animation";

export type JobEvent =
  | { type: "queue" }
  | { type: "submit"; operationId?: string | null }
  | { type: "progress"; progress?: number | null }
  | { type: "complete" }
  | { type: "fail"; retryable?: boolean }
  | { type: "block" }
  | { type: "unconfigured" }
  | { type: "unavailable" }
  | { type: "cancel" };

export function isGenerationJobStatus(value: string): value is GenerationJobStatus {
  return (GENERATION_JOB_STATUSES as readonly string[]).includes(value);
}

export function jobProgressPercent(status: GenerationJobStatus, reported?: number | null): number | null {
  if (status === "completed") return 100;
  if (status === "queued") return 0;
  if (status === "failed" || status === "blocked" || status === "cancelled" || status === "needs_configuration" || status === "unavailable") {
    return null;
  }
  if (typeof reported === "number" && Number.isFinite(reported)) {
    return Math.max(0, Math.min(99, Math.round(reported)));
  }
  if (status === "submitted") return 10;
  if (status === "processing") return 40;
  return 0;
}

export function jobUiLabel(status: GenerationJobStatus): string {
  switch (status) {
    case "queued":
      return "Requested";
    case "submitted":
    case "processing":
      return "Running";
    case "completed":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "blocked":
      return "Blocked";
    case "cancelled":
      return "Cancelled";
    case "needs_configuration":
      return "Needs configuration";
    case "unavailable":
      return "Unavailable";
    default:
      return "Not started";
  }
}

export function canRetryJob(status: GenerationJobStatus, retryable: boolean): boolean {
  if (status === "blocked" || status === "cancelled" || status === "completed") return false;
  if (status === "needs_configuration") return false;
  return retryable || status === "failed" || status === "unavailable";
}

export function transitionJob(current: GenerationJobStatus, event: JobEvent): GenerationJobStatus {
  if (current === "completed" && event.type !== "queue") return current;
  if (current === "cancelled" && event.type !== "queue") return current;
  switch (event.type) {
    case "queue":
      return "queued";
    case "submit":
      return "submitted";
    case "progress":
      return current === "queued" ? "processing" : current === "submitted" ? "processing" : current;
    case "complete":
      return "completed";
    case "fail":
      return "failed";
    case "block":
      return "blocked";
    case "unconfigured":
      return "needs_configuration";
    case "unavailable":
      return "unavailable";
    case "cancel":
      return current === "completed" ? current : "cancelled";
    default:
      return current;
  }
}

export function generationProviderLabel(kind: GenerationJobKind | string): string {
  if (kind === "text" || kind === "structured-storyboard" || kind === "still") return "Gemini";
  if (kind === "gif" || kind === "reel") return "Mux";
  return "Veo";
}

export function generationIdempotencyKey(input: {
  participantId: string;
  kind: GenerationJobKind;
  panelId?: string | null;
  prompt: string;
  mode?: string | null;
}): string {
  const basis = [
    input.participantId,
    input.kind,
    input.panelId ?? "work",
    input.mode ?? "",
    input.prompt.trim(),
  ].join("|");
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return `gen:${input.kind}:${hash.toString(16)}`;
}

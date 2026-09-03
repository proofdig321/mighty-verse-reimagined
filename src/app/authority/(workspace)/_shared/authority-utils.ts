// Authority-wide utilities, constants, and business logic.
// Single source of truth — import from here, never redefine locally.

// ─── Constants ────────────────────────────────────────────────────────────────

export const WORK_TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "scene": "Scene",
  "interpretation": "Interpretation",
  "other": "Other",
};

export const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Other",
};

export const PROJECTION_TYPES = ["experiential", "distributional", "archival", "other"] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

export function shortId(id: string) { return id.slice(0, 8); }

export async function api(path: string, body?: unknown, method?: "POST" | "PATCH") {
  const res = await fetch(path, {
    method: body ? (method ?? "POST") : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ...JSON.parse(text), status: res.status };
  } catch {
    return { error: `The service returned no readable response (HTTP ${res.status}).`, status: res.status };
  }
}

export async function responseData(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { error: `The service returned no readable response (HTTP ${res.status}).` }; }
}

// ─── Operator feedback ────────────────────────────────────────────────────────

export function operatorError(value: unknown, context?: { workTitle?: string; operation?: string; mediaTitle?: string }) {
  const message = String(value ?? "");
  const prefix = context?.workTitle && context.operation ? `${context.workTitle} — ${context.operation}: ` : "";
  if (/collectible designation blocked/i.test(message)) {
    const media = context?.mediaTitle ? ` Video: ${context.mediaTitle}.` : "";
    return `${prefix}Collectible designation is blocked because the attached video does not have a confirmed rights holder.${media} Next: establish the video's rights before designating it as collectible.`;
  }
  if (/uuid|participant/i.test(message)) return `${prefix}The selected participant could not be identified as a registered Mighty Verse participant. Next: select a registered participant and try again.`;
  if (/rights holder|rights basis|unknown rights/i.test(message)) return `${prefix}The attached video does not yet have a confirmed rights holder. Next: establish the video's rights before continuing.`;
  if (/json|unexpected end|incomplete response/i.test(message)) return `${prefix}The service returned an incomplete response. Next: retry the operation.`;
  return `${prefix}${message || "The operation could not be completed."} Next: review the work details and try again.`;
}

// ─── Status types ─────────────────────────────────────────────────────────────

export type WorkStatus = {
  ready: boolean;
  needs: string;
  hasState: boolean;
  hasExperience: boolean;
  hasMedia: boolean;
  playable: boolean;
  hasArtwork: boolean;
  needsTimeline: boolean;
  hasRealization: boolean;
  rightsVerified: boolean;
};

// Minimal structural types for status computation — compatible with both
// AuthorityData array members and the single-work page types.
type StatusMaster = { canonical_type: string };
type StatusState = undefined | { canonical_state_id: string };
type StatusProjection = undefined | { projection_id: string };
type StatusBinding = undefined | {
  start_ms: number | null;
  end_ms: number | null;
  realization_id: string | null;
  media_asset: { storage_ref: string; rights_holder_ref: string | null; rights_basis: string | null } | null;
};
type StatusPresentation = undefined | null | { artwork_asset_id: string | null };
type StatusRealization = { realization_id: string; master_id: string }[];

export function getWorkStatus(
  master: StatusMaster,
  state: StatusState,
  projection: StatusProjection,
  binding: StatusBinding,
  presentation: StatusPresentation,
  projectionPresentation: StatusPresentation,
  realizations: StatusRealization,
  masterId?: string
): WorkStatus {
  const hasState = !!state;
  const hasExperience = !!projection;
  const hasMedia = !!binding;
  const playable = !!binding?.media_asset?.storage_ref && !binding.media_asset.storage_ref.startsWith("seed:placeholder:");
  const hasArtwork = !!(presentation?.artwork_asset_id || projectionPresentation?.artwork_asset_id);
  const needsTimelineCheck = master.canonical_type === "scene";
  const hasTimeline = !needsTimelineCheck || (binding?.start_ms != null && binding?.end_ms != null);
  const realization = realizations.find(r =>
    r.realization_id === (binding as { realization_id?: string | null } | undefined)?.realization_id ||
    (masterId ? r.master_id === masterId : false)
  );
  const hasRealization = !!realization;
  const rightsVerified = !!binding?.media_asset?.rights_holder_ref && !!binding.media_asset.rights_basis;
  const mediaRequired = master.canonical_type !== "creative-moment";
  const needs = !hasState
    ? "Needs authorisation"
    : !hasExperience
    ? "Needs experience"
    : mediaRequired && (!hasMedia || !playable)
    ? "Needs media"
    : !hasTimeline
    ? "Needs timeline"
    : "Ready";
  const operationalNeeds = needs !== "Ready"
    ? needs
    : playable && !rightsVerified
    ? "Needs rights review"
    : !hasTimeline
    ? "Needs timeline"
    : needsTimelineCheck && !hasRealization
    ? "Needs production version"
    : "Ready";
  return { ready: operationalNeeds === "Ready", needs: operationalNeeds, hasState, hasExperience, hasMedia, playable, hasArtwork, needsTimeline: !hasTimeline, hasRealization, rightsVerified };
}

// ─── Journey ──────────────────────────────────────────────────────────────────

export type JourneyStep = { label: string; state: "complete" | "current" | "blocked" | "optional" | "not-applicable" };

export function getJourneySteps(master: StatusMaster, status: WorkStatus): JourneyStep[] {
  const realizationRequired = master.canonical_type === "scene";
  const mediaRequired = master.canonical_type !== "creative-moment";
  const rightsState = !status.playable ? "not-applicable" : status.rightsVerified ? "complete" : "blocked";
  return [
    { label: "Work", state: "complete" },
    { label: "Authorised", state: status.hasState ? "complete" : "current" },
    { label: "Experience", state: status.hasExperience ? "complete" : status.hasState ? "current" : "not-applicable" },
    { label: "Media", state: !mediaRequired ? "not-applicable" : status.playable ? "complete" : status.hasExperience ? "current" : "not-applicable" },
    { label: "Rights", state: rightsState },
    { label: "Artwork", state: status.hasArtwork ? "complete" : "optional" },
    { label: "Timeline", state: master.canonical_type !== "scene" ? "not-applicable" : status.needsTimeline ? status.hasMedia ? "current" : "not-applicable" : "complete" },
    { label: "Production version", state: !realizationRequired ? "not-applicable" : status.hasRealization ? "complete" : status.playable ? "current" : "not-applicable" },
    { label: "Ready", state: status.ready ? "complete" : "current" },
  ];
}

export function getNextAction(master: StatusMaster, status: WorkStatus) {
  if (!status.hasState) return "Authorise work";
  if (!status.hasExperience) return "Create experience";
  if (master.canonical_type !== "creative-moment" && !status.playable) return "Attach media";
  if (status.needsTimeline) return "Set timeline";
  if (status.playable && !status.rightsVerified) return "Review rights";
  if (master.canonical_type === "scene" && !status.hasRealization) return "Record production version";
  return status.ready ? "Review publication" : "Verify readiness";
}

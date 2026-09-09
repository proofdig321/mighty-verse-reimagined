/**
 * Create Work resume checkpoints.
 *
 * Canonical master/state/projection may exist before video processing finishes.
 * Retry must resume those records — never register a second Universe.
 */

export type CreateWorkType = "universe" | "mural" | "scene" | "creative-moment";

export type CreateWorkCheckpoint = {
  workType: CreateWorkType;
  title: string;
  masterId: string;
  stateId?: string | null;
  projectionId?: string | null;
  sessionId?: string | null;
  uploadUrl?: string | null;
  uploaded?: boolean;
  attached?: boolean;
  assetId?: string | null;
};

export type CreateWorkStep =
  | "register_master"
  | "authorise_state"
  | "create_projection"
  | "create_session"
  | "upload"
  | "poll_process"
  | "attach"
  | "complete";

export const SUPER_HERO_EGO_UNIVERSE = "05ccc0c6-75f9-4864-b0c1-af5e36bf45cc";
export const SUPER_HERO_EGO_MURAL = "a75ae8af-7b48-4b67-8392-d89447bae370";
export const SUPER_HERO_EGO_MUX_ASSET = "795c057e-2967-4e93-8f5e-06297c674cb0";

export function createWorkStorageKey(workType: string, title: string): string {
  return `mighty-verse:create-work:${workType}:${title.trim().toLowerCase()}`;
}

export function nextCreateWorkStep(
  checkpoint: CreateWorkCheckpoint | null,
  hasMedia: boolean,
): CreateWorkStep {
  if (!checkpoint?.masterId) return "register_master";
  if (!checkpoint.stateId) return "authorise_state";
  if (!checkpoint.projectionId) return "create_projection";
  if (!hasMedia) return "complete";
  if (!checkpoint.sessionId) return "create_session";
  if (!checkpoint.uploaded) return "upload";
  if (!checkpoint.attached) return "poll_process";
  return "complete";
}

export function assertRetryDoesNotReregister(checkpoint: CreateWorkCheckpoint | null): boolean {
  return Boolean(checkpoint?.masterId);
}

export function isProtectedCanonicalId(id: string | null | undefined): boolean {
  if (!id) return false;
  return (
    id === SUPER_HERO_EGO_UNIVERSE ||
    id === SUPER_HERO_EGO_MURAL ||
    id === SUPER_HERO_EGO_MUX_ASSET
  );
}

export type CreateWorkContinuation = {
  href: string;
  label: string;
  primary?: boolean;
};

export function createWorkContinuations(input: {
  workType: CreateWorkType;
  masterId: string;
  parentMasterId?: string | null;
  assetId?: string | null;
  mediaAttached: boolean;
  processingWaiting?: boolean;
}): CreateWorkContinuation[] {
  const universeId = input.workType === "universe" ? input.masterId : input.parentMasterId ?? null;
  const actions: CreateWorkContinuation[] = [];

  if (input.processingWaiting) {
    actions.push({ href: `/authority/${input.masterId}`, label: "Open work", primary: true });
    if (universeId) {
      actions.push({ href: `/authority/curate?universe=${universeId}`, label: "Continue in Curate" });
    }
    return actions;
  }

  if (universeId) {
    actions.push({
      href: `/authority/universes/${universeId}`,
      label: "Open Creative Suite",
      primary: true,
    });
    actions.push({ href: `/authority/curate?universe=${universeId}`, label: "Continue in Curate" });
  }

  actions.push({
    href: `/authority/${input.masterId}`,
    label: "Open work",
    primary: actions.length === 0,
  });

  if (input.assetId && input.mediaAttached) {
    actions.push({ href: `/authority/media/inspect?assetId=${input.assetId}`, label: "Inspect media" });
  }

  return actions;
}

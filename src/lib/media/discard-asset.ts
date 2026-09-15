/**
 * Operator discard of incoming media.
 *
 * MEDIA ≠ CREATIVE WORK. Discard hides an asset from Incoming / Gallery.
 * It does not delete a Universe, Mural, Scene, or Creative Moment.
 * Super Hero Ego and Father Raymond playback assets cannot be discarded.
 * Records stay; storage_ref is prefixed so catalogue queries skip them.
 */

import { SUPER_HERO_EGO_MUX_ASSET_ID } from "../assemble/protected-work";
import type { UniverseOccupancy } from "../assemble/occupancy";

export const FATHER_RAYMOND_MUX_ASSET_ID = "5f85a6f1-1f2a-4da7-af9b-8467e58d3b9c";
export const DISCARDED_STORAGE_PREFIX = "operator:discarded:";

export const PROTECTED_MEDIA_ASSET_IDS: ReadonlySet<string> = new Set([
  SUPER_HERO_EGO_MUX_ASSET_ID,
  FATHER_RAYMOND_MUX_ASSET_ID,
]);

export function isProtectedMediaAsset(assetId: string | null | undefined): boolean {
  return Boolean(assetId && PROTECTED_MEDIA_ASSET_IDS.has(assetId));
}

export function isDiscardedStorageRef(storageRef: string | null | undefined): boolean {
  return Boolean(storageRef?.startsWith(DISCARDED_STORAGE_PREFIX));
}

export function markDiscardedStorageRef(storageRef: string): string {
  if (storageRef.startsWith(DISCARDED_STORAGE_PREFIX)) return storageRef;
  return `${DISCARDED_STORAGE_PREFIX}${storageRef}`;
}

export type DiscardMediaDecision =
  | { ok: true; action: "discard"; assetId: string; message: string }
  | {
      ok: false;
      code: "invalid_asset" | "protected_media" | "live_binding" | "already_discarded";
      assetId: string | null;
      message: string;
    };

export function decideDiscardMedia(input: {
  assetId: string | null | undefined;
  storageRef?: string | null;
  liveCanonicalBinding?: boolean;
}): DiscardMediaDecision {
  const assetId = input.assetId?.trim() || null;
  if (!assetId) {
    return {
      ok: false,
      code: "invalid_asset",
      assetId: null,
      message: "A media asset is required to delete.",
    };
  }

  if (isProtectedMediaAsset(assetId)) {
    return {
      ok: false,
      code: "protected_media",
      assetId,
      message: "Canonical playback media cannot be deleted. Super Hero Ego and Father Raymond stay.",
    };
  }

  if (isDiscardedStorageRef(input.storageRef)) {
    return {
      ok: false,
      code: "already_discarded",
      assetId,
      message: "This media is already removed from Incoming.",
    };
  }

  if (input.liveCanonicalBinding) {
    return {
      ok: false,
      code: "live_binding",
      assetId,
      message: "This media is attached to live canonical work. Withdraw the work first, or leave the media in place.",
    };
  }

  return {
    ok: true,
    action: "discard",
    assetId,
    message: "Remove this media from Incoming. This does not delete a Universe. Records stay.",
  };
}

export function mediaHasLiveCanonicalBinding(input: {
  boundUniverses: Array<{
    title: string | null;
    occupancy: UniverseOccupancy;
    protected?: boolean;
  }>;
}): boolean {
  return input.boundUniverses.some((universe) => {
    if (universe.protected) return true;
    const titled = Boolean(universe.title?.trim());
    return titled && (universe.occupancy === "curated" || universe.occupancy === "in_progress");
  });
}

export function mediaIsDeletable(input: {
  assetId: string | null | undefined;
  storageRef?: string | null;
  liveCanonicalBinding?: boolean;
}): boolean {
  return decideDiscardMedia(input).ok;
}

export const EXCLUDED_INTAKE_SEARCH_STATUS = "excluded";

export function isExcludedIntake(searchStatus: string | null | undefined): boolean {
  return searchStatus === EXCLUDED_INTAKE_SEARCH_STATUS;
}

export function isAwaitingUploadIntake(input: {
  assetId?: string | null;
  searchStatus?: string | null;
}): boolean {
  return !input.assetId && !isExcludedIntake(input.searchStatus);
}

export type DiscardIntakeDecision =
  | { ok: true; action: "discard"; intakeId: string; message: string }
  | {
      ok: false;
      code: "invalid_intake" | "already_discarded" | "linked_media" | "protected_media";
      intakeId: string | null;
      message: string;
    };

export function decideDiscardIntake(input: {
  intakeId: string | null | undefined;
  assetId?: string | null;
  searchStatus?: string | null;
}): DiscardIntakeDecision {
  const intakeId = input.intakeId?.trim() || null;
  if (!intakeId) {
    return {
      ok: false,
      code: "invalid_intake",
      intakeId: null,
      message: "An intake record is required to delete.",
    };
  }

  if (isExcludedIntake(input.searchStatus)) {
    return {
      ok: false,
      code: "already_discarded",
      intakeId,
      message: "This intake is already removed from Gallery.",
    };
  }

  if (isProtectedMediaAsset(input.assetId)) {
    return {
      ok: false,
      code: "protected_media",
      intakeId,
      message: "Canonical playback media cannot be deleted. Super Hero Ego and Father Raymond stay.",
    };
  }

  if (input.assetId) {
    return {
      ok: false,
      code: "linked_media",
      intakeId,
      message: "This intake is already linked to media. Delete the media from Gallery if it is an orphan.",
    };
  }

  return {
    ok: true,
    action: "discard",
    intakeId,
    message: "Remove this intake from Gallery. This does not delete a Universe. Records stay.",
  };
}

export function intakeIsDeletable(input: {
  intakeId: string | null | undefined;
  assetId?: string | null;
  searchStatus?: string | null;
}): boolean {
  return decideDiscardIntake(input).ok;
}

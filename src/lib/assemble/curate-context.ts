/**
 * Curate Studio — carry Gallery / Inspect media identity through navigation.
 *
 * Context is query state (`?asset=`), not a new entity. The live Curate
 * incoming catalogue remains authoritative: a client-supplied id cannot
 * invent an asset or reassign a bound one.
 */

import type { CurateStudioMedia } from "./studio";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CurateAssetNextAction = "associate" | "creative_suite" | "unavailable";

export type CurateAssetFocus = {
  asset_id: string;
  found: boolean;
  bound: boolean;
  universe_id: string | null;
  universe_title: string | null;
  mural_title: string | null;
  next: CurateAssetNextAction;
};

function isId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function resolveCurateAssetFocus(input: {
  requestedAssetId: string | null | undefined;
  media: CurateStudioMedia[];
}): CurateAssetFocus | null {
  const requested = typeof input.requestedAssetId === "string" ? input.requestedAssetId.trim() : "";
  if (!requested) {
    return null;
  }
  if (!isId(requested)) {
    return {
      asset_id: requested,
      found: false,
      bound: false,
      universe_id: null,
      universe_title: null,
      mural_title: null,
      next: "unavailable",
    };
  }

  const match = input.media.find((row) => row.asset_id === requested);
  if (!match) {
    return {
      asset_id: requested,
      found: false,
      bound: false,
      universe_id: null,
      universe_title: null,
      mural_title: null,
      next: "unavailable",
    };
  }

  const universeId = match.association.universe_id;
  if (universeId) {
    return {
      asset_id: match.asset_id,
      found: true,
      bound: true,
      universe_id: universeId,
      universe_title: match.association.universe_title,
      mural_title: match.association.mural_title,
      next: "creative_suite",
    };
  }

  return {
    asset_id: match.asset_id,
    found: true,
    bound: false,
    universe_id: null,
    universe_title: null,
    mural_title: null,
    next: "associate",
  };
}

/**
 * Universe occupancy is an explicit choice. Bound incoming media does not
 * auto-open that Universe's hub — Curate index stays a short incoming catalogue.
 * An explicit `universe` query still selects occupancy for legacy redirects,
 * but never rewrites the focused asset's association.
 */
export function resolveCurateUniverseSelection(input: {
  requestedUniverseId: string | null | undefined;
  focusedAsset: CurateAssetFocus | null;
}): string | null {
  if (isId(input.requestedUniverseId)) {
    return input.requestedUniverseId.trim();
  }
  void input.focusedAsset;
  return null;
}

export function pinFocusedIncomingMedia(
  media: CurateStudioMedia[],
  focusedAssetId: string | null | undefined,
): CurateStudioMedia[] {
  if (!focusedAssetId) {
    return media;
  }
  const index = media.findIndex((row) => row.asset_id === focusedAssetId);
  if (index <= 0) {
    return media;
  }
  const focused = media[index];
  return [focused, ...media.filter((row) => row.asset_id !== focusedAssetId)];
}

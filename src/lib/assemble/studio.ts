/**
 * Curate Studio — shared orchestration between media intake/Sentinel and Creative Suite.
 *
 * MEDIA ≠ UNIVERSE. Association is derived from existing projection_media_binding
 * → projection → master ancestry. This module does not create canonical works.
 *
 * Authority and future public curators inject their own base paths and mutations.
 */

import { READINESS_LABELS, type MediaReadiness } from "../media/readiness";

export const CURATE_STUDIO_HREF = "/authority/curate";
export const MEDIA_INTAKE_HREF = "/authority/media/intake";
export const MEDIA_INSPECT_HREF = "/authority/media/inspect";

export const CURATE_LIFECYCLE = [
  "Intake",
  "Sentinel",
  "Curate Studio",
  "Creative Suite",
  "Publish",
  "Experience",
] as const;

export type StudioFrom = "curate";

export type CanonicalMasterRef = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type StudioAssociation = {
  universe_id: string | null;
  universe_title: string | null;
  mural_id: string | null;
  mural_title: string | null;
  scene_titles: string[];
  bound_as: "universe" | "mural" | "scene" | "creative-moment" | null;
};

export type StudioInspectionSummary = {
  status: string;
  candidate_count: number | null;
  started_at: string;
};

export type CurateStudioMedia = {
  asset_id: string;
  title: string | null;
  provider: string | null;
  storage_ref: string;
  duration_ms: number | null;
  work_type: string | null;
  readiness_overall: MediaReadiness["overall"];
  readiness_blockers: string[];
  inspection: StudioInspectionSummary | null;
  association: StudioAssociation;
};

export function mediaInspectHref(assetId: string): string {
  return `${MEDIA_INSPECT_HREF}?assetId=${assetId}`;
}

export function curateStudioHref(
  universeId?: string | null,
  assetId?: string | null,
): string {
  const params = new URLSearchParams();
  if (universeId) {
    params.set("universe", universeId);
  }
  if (assetId) {
    params.set("asset", assetId);
  }
  const query = params.toString();
  return query ? `${CURATE_STUDIO_HREF}?${query}` : CURATE_STUDIO_HREF;
}

export function creativeSuiteHref(universeId: string, from?: StudioFrom | null): string {
  const path = `/authority/universes/${universeId}`;
  return from === "curate" ? `${path}?from=curate` : path;
}

export function creativeSuiteSentinelHref(universeId: string, from?: StudioFrom | null): string {
  return `${creativeSuiteHref(universeId, from)}#universe-sentinel`;
}

export function creativeSuiteIdentityHref(universeId: string, from?: StudioFrom | null): string {
  const path = `/authority/universes/${universeId}/identity`;
  return from === "curate" ? `${path}?from=curate` : path;
}

export function studioReadinessLabel(overall: MediaReadiness["overall"]): string {
  return READINESS_LABELS[overall];
}

export function studioInspectionLabel(inspection: StudioInspectionSummary | null): string {
  if (!inspection) return "Not inspected";
  return inspection.status;
}

/**
 * Resolve a bound master's Universe ancestor.
 * Creative Moments parent to Universe. Scenes parent to Mural. Mural parents to Universe.
 */
export function universeIdForMaster(
  master: CanonicalMasterRef,
  byId: Map<string, CanonicalMasterRef>,
): string | null {
  if (master.canonical_type === "universe") return master.master_id;
  if (master.canonical_type === "creative-moment") {
    return master.parent_master_id;
  }
  if (master.canonical_type === "mural") {
    return master.parent_master_id;
  }
  if (master.canonical_type === "scene") {
    const mural = master.parent_master_id ? byId.get(master.parent_master_id) : undefined;
    return mural?.parent_master_id ?? null;
  }
  let current: CanonicalMasterRef | undefined = master;
  for (let i = 0; i < 4 && current; i++) {
    if (current.canonical_type === "universe") return current.master_id;
    current = current.parent_master_id ? byId.get(current.parent_master_id) : undefined;
  }
  return null;
}

/**
 * Derive Creative Suite association for one media asset from existing bindings.
 * Does not treat the asset as a Universe.
 */
export function associateAssetWithCanonicalWork(input: {
  assetId: string;
  bindings: { asset_id: string; projection_id: string }[];
  projections: { projection_id: string; master_id: string }[];
  masters: CanonicalMasterRef[];
  presentations: { master_id: string; title: string | null }[];
}): StudioAssociation {
  const empty: StudioAssociation = {
    universe_id: null,
    universe_title: null,
    mural_id: null,
    mural_title: null,
    scene_titles: [],
    bound_as: null,
  };

  const byId = new Map(input.masters.map((master) => [master.master_id, master]));
  const titles = new Map(input.presentations.map((row) => [row.master_id, row.title]));
  const projById = new Map(input.projections.map((row) => [row.projection_id, row]));

  const boundMasters = input.bindings
    .filter((binding) => binding.asset_id === input.assetId)
    .map((binding) => {
      const projection = projById.get(binding.projection_id);
      return projection ? byId.get(projection.master_id) : undefined;
    })
    .filter((master): master is CanonicalMasterRef => Boolean(master));

  if (boundMasters.length === 0) return empty;

  const universeMaster =
    boundMasters.find((master) => master.canonical_type === "universe") ??
    boundMasters
      .map((master) => {
        const universeId = universeIdForMaster(master, byId);
        return universeId ? byId.get(universeId) : undefined;
      })
      .find((master): master is CanonicalMasterRef => Boolean(master));

  const muralMaster =
    boundMasters.find((master) => master.canonical_type === "mural") ??
    boundMasters
      .map((master) => {
        if (master.canonical_type !== "scene" || !master.parent_master_id) return undefined;
        return byId.get(master.parent_master_id);
      })
      .find((master): master is CanonicalMasterRef => master?.canonical_type === "mural");

  const sceneTitles = boundMasters
    .filter((master) => master.canonical_type === "scene")
    .map((master) => titles.get(master.master_id) ?? "Untitled scene");

  const boundAs: StudioAssociation["bound_as"] = boundMasters.some((m) => m.canonical_type === "mural")
    ? "mural"
    : boundMasters.some((m) => m.canonical_type === "scene")
      ? "scene"
      : boundMasters.some((m) => m.canonical_type === "universe")
        ? "universe"
        : boundMasters.some((m) => m.canonical_type === "creative-moment")
          ? "creative-moment"
          : null;

  const universeId = universeMaster?.master_id ?? universeIdForMaster(boundMasters[0], byId);

  return {
    universe_id: universeId,
    universe_title: universeId ? titles.get(universeId) ?? null : null,
    mural_id: muralMaster?.master_id ?? null,
    mural_title: muralMaster ? titles.get(muralMaster.master_id) ?? null : null,
    scene_titles: sceneTitles,
    bound_as: boundAs,
  };
}

export function mediaIsCanonicalUniverse(assetId: string, association: StudioAssociation): boolean {
  return association.universe_id === assetId;
}

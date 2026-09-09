/**
 * Experience projection consumes canonical structure plus approved, attached
 * production results. It must not render Gallery dumps, Sentinel frames,
 * curated references, or unapproved generated intermediates.
 *
 * Canonical Scene timing remains authoritative. Production assets do not
 * redefine windows. CSS 2.5D stays the projection engine.
 */

import type { HolographicLayer } from "../media/sentinel-intelligence";

export type ApprovedProductionLayer = {
  layer_id: string;
  scene_master_id: string;
  title?: string | null;
  still_url: string | null;
  approved: boolean;
  attached: boolean;
};

export function productionLayersFromResults(
  results: Array<{
    asset_id: string;
    scene_master_id: string;
    title?: string | null;
    still_url: string | null;
    approval: "awaiting" | "approved" | "rejected";
    attached: boolean;
  }>,
): ApprovedProductionLayer[] {
  return results.map((result) => ({
    layer_id: `production-${result.asset_id}`,
    scene_master_id: result.scene_master_id,
    title: result.title ?? "Production",
    still_url: result.still_url,
    approved: result.approval === "approved",
    attached: result.attached,
  }));
}

/**
 * Compose 2.5D layers from canonical Sentinel holographic output plus any
 * approved and attached production results. Unapproved results stay in Gallery.
 */
export function composeExperienceProjection(input: {
  canonical_layers: HolographicLayer[];
  realizations?: ApprovedProductionLayer[] | null;
}): {
  layers: HolographicLayer[];
  production_count: number;
  injects_gallery: false;
  injects_evidence: false;
  redefines_timing: false;
} {
  const approved = (input.realizations ?? []).filter(
    (layer) => layer.approved && layer.attached && Boolean(layer.still_url),
  );
  const productionLayers: HolographicLayer[] = approved.map((layer, index) => ({
    layer_id: layer.layer_id,
    kind: "production",
    master_id: layer.scene_master_id,
    title: layer.title ?? "Production",
    still_url: layer.still_url,
    depth: 36 + index * 24,
    offset_x: (index - (approved.length - 1) / 2) * 96,
    offset_y: 56,
    related_scene_ids: [layer.scene_master_id],
  }));
  return {
    layers: [...input.canonical_layers, ...productionLayers],
    production_count: productionLayers.length,
    injects_gallery: false,
    injects_evidence: false,
    redefines_timing: false,
  };
}

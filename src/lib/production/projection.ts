/**
 * Experience projection consumes canonical structure plus approved production
 * realizations. It must not render Gallery dumps, Sentinel frames, or
 * unapproved generated intermediates.
 *
 * Canonical Scene timing remains authoritative. Production assets do not
 * redefine windows. CSS 2.5D stays the projection engine.
 */

import type { HolographicLayer } from "../media/sentinel-intelligence";

export type ApprovedProductionLayer = {
  layer_id: string;
  scene_master_id: string;
  still_url: string | null;
  approved: boolean;
};

/**
 * Compose 2.5D layers from canonical Sentinel holographic output plus any
 * approved production realizations. Realizations are not fabricated.
 *
 * Until a dedicated production layer kind exists on the holographic stage,
 * approved realizations are recorded in Gallery/Studio and are not injected
 * as mural/scene/moment objects.
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
  const approved = (input.realizations ?? []).filter((layer) => layer.approved && Boolean(layer.still_url));
  return {
    layers: input.canonical_layers,
    production_count: approved.length,
    injects_gallery: false,
    injects_evidence: false,
    redefines_timing: false,
  };
}

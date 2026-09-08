/**
 * Curate Studio — associate inspected/playable media with an existing Universe.
 *
 * MEDIA ≠ CREATIVE WORK. This module does not create Universes, Murals, Scenes,
 * Creative Moments, projections, or media_realization rows.
 *
 * Association means: bind the asset to the Universe's existing Mural projection
 * via the established POST /api/authority/media contract. Ancestry then makes
 * the Universe discoverable.
 */

import type { MediaReadiness } from "../media/readiness";
import type { StudioAssociation } from "./studio";

export const CREATE_WORK_HREF = "/authority/create";

export type UniverseAssociationTarget = {
  universe_id: string;
  universe_title: string | null;
  mural_id: string | null;
  mural_title: string | null;
  projection_id: string | null;
  bound_asset_id: string | null;
  compatible: boolean;
  blocked_reason: "no_mural" | "no_projection" | null;
};

export type AssociationEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type AssociationBind = {
  projection_id: string;
  master_id: string;
  asset_id: string;
};

export type AssociationDecision =
  | {
      ok: true;
      action: "already_associated";
      message: string;
      target: UniverseAssociationTarget;
      bind: AssociationBind;
    }
  | {
      ok: true;
      action: "bind";
      message: string;
      target: UniverseAssociationTarget;
      bind: AssociationBind;
    }
  | {
      ok: false;
      code:
        | "invalid_universe"
        | "no_mural"
        | "no_projection"
        | "ineligible"
        | "mural_occupied"
        | "wrong_work";
      message: string;
      target: UniverseAssociationTarget | null;
    };

export function mediaAssociationEligibility(input: {
  readiness_overall: MediaReadiness["overall"];
  readiness_blockers: string[];
}): AssociationEligibility {
  const playable = input.readiness_overall === "playable" || input.readiness_overall === "ready";
  if (playable) {
    return { eligible: true, reasons: [] };
  }
  const reasons = input.readiness_blockers.length
    ? input.readiness_blockers
    : ["Media is not yet playable"];
  return { eligible: false, reasons };
}

export function buildUniverseAssociationTarget(input: {
  universeId: string;
  universeTitle: string | null;
  mural: { master_id: string; title: string | null } | null;
  projectionId: string | null;
  boundAssetId: string | null;
}): UniverseAssociationTarget {
  const blocked_reason: UniverseAssociationTarget["blocked_reason"] = !input.mural
    ? "no_mural"
    : !input.projectionId
      ? "no_projection"
      : null;
  return {
    universe_id: input.universeId,
    universe_title: input.universeTitle,
    mural_id: input.mural?.master_id ?? null,
    mural_title: input.mural?.title ?? null,
    projection_id: input.projectionId,
    bound_asset_id: input.boundAssetId,
    compatible: blocked_reason === null,
    blocked_reason,
  };
}

export function projectionBelongsToUniverse(
  projectionMasterId: string,
  universeId: string,
  mural: { master_id: string; parent_master_id: string | null } | null,
): boolean {
  return Boolean(
    mural &&
      projectionMasterId === mural.master_id &&
      mural.parent_master_id === universeId,
  );
}

export function decideCanonicalAssociation(input: {
  assetId: string;
  universeId: string | null;
  eligibility: AssociationEligibility;
  target: UniverseAssociationTarget | null;
  clientProjectionId?: string | null;
}): AssociationDecision {
  if (!input.universeId || !input.target) {
    return {
      ok: false,
      code: "invalid_universe",
      message: "Choose an existing Universe. Media does not become a Universe by being uploaded.",
      target: input.target,
    };
  }

  if (input.target.universe_id !== input.universeId) {
    return {
      ok: false,
      code: "wrong_work",
      message: "That Mural does not belong to the selected Universe.",
      target: input.target,
    };
  }

  if (!input.eligibility.eligible) {
    return {
      ok: false,
      code: "ineligible",
      message: input.eligibility.reasons[0] ?? "This media is not ready to associate.",
      target: input.target,
    };
  }

  if (input.target.blocked_reason === "no_mural" || !input.target.mural_id) {
    return {
      ok: false,
      code: "no_mural",
      message: "No compatible canonical work available. This Universe has no Mural yet. Association does not create a Mural.",
      target: input.target,
    };
  }

  if (input.target.blocked_reason === "no_projection" || !input.target.projection_id) {
    return {
      ok: false,
      code: "no_projection",
      message: "This Universe's Mural has no presentation to receive media yet. Association does not create one.",
      target: input.target,
    };
  }

  if (input.clientProjectionId && input.clientProjectionId !== input.target.projection_id) {
    return {
      ok: false,
      code: "wrong_work",
      message: "That presentation does not belong to the selected Universe's Mural.",
      target: input.target,
    };
  }

  const bind: AssociationBind = {
    projection_id: input.target.projection_id,
    master_id: input.target.mural_id,
    asset_id: input.assetId,
  };

  const workName = input.target.universe_title ?? "this Universe";
  const muralName = input.target.mural_title ?? "its Mural";

  if (input.target.bound_asset_id === input.assetId) {
    return {
      ok: true,
      action: "already_associated",
      message: `This media is already associated with ${workName}. Continue in Creative Suite.`,
      target: input.target,
      bind,
    };
  }

  if (input.target.bound_asset_id && input.target.bound_asset_id !== input.assetId) {
    return {
      ok: false,
      code: "mural_occupied",
      message: `${workName}'s Mural already has different media. Association does not replace existing Mural media.`,
      target: input.target,
    };
  }

  return {
    ok: true,
    action: "bind",
    message: `Associate this media with ${workName}. It will be bound to the existing Mural ${muralName}. This does not create a Universe.`,
    target: input.target,
    bind,
  };
}

export function associationStatusLabel(association: StudioAssociation): string {
  if (!association.universe_id) return "Not associated";
  return association.universe_title ?? "Untitled universe";
}

export function existingMediaBindRequest(bind: AssociationBind) {
  return {
    projection_id: bind.projection_id,
    master_id: bind.master_id,
    asset_id: bind.asset_id,
    rights_holder_ref: null,
    rights_basis: null,
    intake_id: null,
  };
}

/**
 * Creative Suite — author Creative Moment identity (title + description).
 *
 * Identity lives on work_presentation. Creative Moments stay Universe-parented.
 * Does not create projections, media, or participant records.
 */

import { validateUniverseIdentity, type UniverseIdentity } from "./identity";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCreativeMomentIdentityId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type CreativeMomentIdentityMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type CreativeMomentIdentityDecisionOk = {
  ok: true;
  action: "update_identity";
  universe_id: string;
  moment_master_id: string;
  identity: UniverseIdentity;
  creates_projection: false;
  creates_media: false;
  touches_presence: false;
};

export type CreativeMomentIdentityRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_creative_moment"
  | "wrong_universe"
  | "invalid_identity";

export type CreativeMomentIdentityDecisionErr = {
  ok: false;
  code: CreativeMomentIdentityRejectCode;
  message: string;
};

export type CreativeMomentIdentityDecision =
  | CreativeMomentIdentityDecisionOk
  | CreativeMomentIdentityDecisionErr;

function reject(
  code: CreativeMomentIdentityRejectCode,
  message: string,
): CreativeMomentIdentityDecisionErr {
  return { ok: false, code, message };
}

export function decideCreativeMomentIdentity(input: {
  universe_id?: string | null;
  moment_master_id?: string | null;
  title?: unknown;
  description?: unknown;
  moment: CreativeMomentIdentityMaster | null;
}): CreativeMomentIdentityDecision {
  const momentId = input.moment_master_id?.trim() || input.moment?.master_id?.trim() || "";
  if (!momentId) {
    return reject("missing_ids", "A Creative Moment is required.");
  }
  if (!isCreativeMomentIdentityId(momentId)) {
    return reject("invalid_id", "Creative Moment must be a canonical identifier.");
  }
  if (!input.moment) {
    return reject("not_found", "Creative Moment was not found.");
  }
  if (input.moment.canonical_type !== "creative-moment") {
    return reject("not_creative_moment", "Identity can only be authored on a Creative Moment.");
  }

  const universeId = input.moment.parent_master_id;
  if (!universeId) {
    return reject("wrong_universe", "A Creative Moment must belong to a Universe.");
  }
  const requestedUniverse = input.universe_id?.trim();
  if (requestedUniverse && requestedUniverse !== universeId) {
    return reject("wrong_universe", "Creative Moment identity can only be authored inside this Universe.");
  }

  const identity = validateUniverseIdentity({ title: input.title, description: input.description });
  if (!identity.ok) {
    return reject("invalid_identity", identity.error);
  }

  return {
    ok: true,
    action: "update_identity",
    universe_id: universeId,
    moment_master_id: momentId,
    identity: identity.value,
    creates_projection: false,
    creates_media: false,
    touches_presence: false,
  };
}

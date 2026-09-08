/**
 * Curate / Creative Suite — register a Mural for an existing Universe.
 *
 * MURAL ≠ MEDIA. This module does not attach media, create Universes, Scenes,
 * Creative Moments, or media_realization rows. It only decides whether the
 * existing registerMaster → createCanonicalState → createProjection path
 * should run for a Universe that still lacks its audiovisual container.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_MURAL_TITLE = "Mural";

export type MuralRegistrationRejectReason =
  | "invalid_universe"
  | "not_found"
  | "not_universe";

export type MuralRegistrationDecision =
  | { action: "reject"; reason: MuralRegistrationRejectReason }
  | { action: "already_registered"; muralId: string; projectionId: string }
  | { action: "complete_projection"; muralId: string }
  | { action: "register" };

export type MuralRegistrationResultKind =
  | "registered"
  | "already_registered"
  | "projection_completed";

export function isUniverseId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function resolveMuralTitle(options: {
  requestedTitle?: string | null;
  universeTitle?: string | null;
}): string {
  const requested = options.requestedTitle?.trim();
  if (requested) return requested;
  const universeTitle = options.universeTitle?.trim();
  if (universeTitle) return universeTitle;
  return DEFAULT_MURAL_TITLE;
}

export function decideMuralRegistration(input: {
  universeId: string | null | undefined;
  universeCanonicalType: string | null | undefined;
  existingMuralId: string | null | undefined;
  existingProjectionId: string | null | undefined;
}): MuralRegistrationDecision {
  if (!isUniverseId(input.universeId)) {
    return { action: "reject", reason: "invalid_universe" };
  }
  if (!input.universeCanonicalType) {
    return { action: "reject", reason: "not_found" };
  }
  if (input.universeCanonicalType !== "universe") {
    return { action: "reject", reason: "not_universe" };
  }

  const muralId = input.existingMuralId?.trim() || null;
  const projectionId = input.existingProjectionId?.trim() || null;

  if (muralId && projectionId) {
    return {
      action: "already_registered",
      muralId,
      projectionId,
    };
  }
  if (muralId) {
    return { action: "complete_projection", muralId };
  }
  return { action: "register" };
}

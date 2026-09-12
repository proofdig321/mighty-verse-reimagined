/**
 * Participant display names.
 *
 * Participant has no label column. Public names come from public attribution.
 * Operator names persist as identity_link identity_type=other, ref display:<name>.
 * Never present participant_id as audience copy.
 */

export const PARTICIPANT_DISPLAY_PREFIX = "display:";

export const PARTICIPANT_ROLE_TYPES = [
  "canonical-creator",
  "collaborator",
  "featured-artist",
  "interpretation-creator",
  "collector",
  "audience",
  "authorised-canonical-authority",
  "delegated-authority",
  "mighty-verse-platform",
  "director",
  "other",
] as const;

export type ParticipantRoleType = (typeof PARTICIPANT_ROLE_TYPES)[number];

export const PARTICIPANT_STATUSES = ["active", "suspended", "deleted"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export function isParticipantRoleType(value: string): value is ParticipantRoleType {
  return (PARTICIPANT_ROLE_TYPES as readonly string[]).includes(value);
}

export function normalizeParticipantStatus(value: string | null | undefined): ParticipantStatus | null {
  if (!value) return null;
  if (value === "inactive") return "suspended";
  if (value === "active" || value === "suspended" || value === "deleted") return value;
  return null;
}

export function parseAttributionDisplayName(description: string | null | undefined): string | null {
  if (!description?.trim()) return null;
  const trimmed = description.trim();
  const separator = trimmed.includes("—") ? "—" : trimmed.includes(" - ") ? " - " : null;
  if (!separator) return null;
  const name = trimmed.split(separator).pop()?.trim() ?? "";
  if (!name) return null;
  if (/scene|mural|extracted|manifestation/i.test(name)) return null;
  if (name.length > 48) return null;
  return name;
}

export function displayNameFromIdentityRef(identityRef: string | null | undefined): string | null {
  if (!identityRef?.startsWith(PARTICIPANT_DISPLAY_PREFIX)) return null;
  const name = identityRef.slice(PARTICIPANT_DISPLAY_PREFIX.length).trim();
  return name || null;
}

export function encodeDisplayIdentityRef(name: string): string {
  return `${PARTICIPANT_DISPLAY_PREFIX}${name.trim()}`;
}

export function pickPublicDisplayName(attributions: Array<{ contribution_description: string | null }>): string | null {
  for (const entry of attributions) {
    const name = parseAttributionDisplayName(entry.contribution_description);
    if (name) return name;
  }
  return null;
}

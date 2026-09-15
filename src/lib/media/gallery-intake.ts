/**
 * YouTube / URL ingest must land in Gallery with a titled intake record.
 * MEDIA ≠ CREATIVE WORK: this does not mint a Universe.
 */

export type UrlIngestIntakeDecision =
  | { mode: "requested" | "reuse"; intakeId: string }
  | { mode: "create" };

export function decideUrlIngestIntake(input: {
  requestedIntakeId?: string | null;
  matchingUnlinkedIntakeId?: string | null;
}): UrlIngestIntakeDecision {
  const requested = input.requestedIntakeId?.trim() || "";
  if (requested) return { mode: "requested", intakeId: requested };
  const matching = input.matchingUnlinkedIntakeId?.trim() || "";
  if (matching) return { mode: "reuse", intakeId: matching };
  return { mode: "create" };
}

export function defaultUrlIngestWorkType(kind: "youtube" | "direct" | string): "video" | "animation" | "other" {
  if (kind === "youtube" || kind === "direct") return "video";
  return "other";
}

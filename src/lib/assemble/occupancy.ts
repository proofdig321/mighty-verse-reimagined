/**
 * Clinical occupancy of a Universe.
 *
 * Audience Discover only lists curated work: a Universe whose Mural has
 * playable (non-placeholder) media. Create Work shells, untitled
 * containers, and retry duplicates are orphans — they are not Experience.
 *
 * MEDIA ≠ CREATIVE WORK. A Universe-level distributional projection is not
 * mural curation.
 */

export type UniverseOccupancy = "curated" | "in_progress" | "orphan" | "withdrawn";

export type UniverseOccupancyInput = {
  title: string | null;
  currentStateId: string | null;
  muralHasPlayableMedia: boolean;
  hasSourceMedia: boolean;
};

export function classifyUniverseOccupancy(input: UniverseOccupancyInput): UniverseOccupancy {
  if (!input.currentStateId) return "withdrawn";
  if (input.muralHasPlayableMedia) return "curated";
  const titled = Boolean(input.title?.trim());
  if (titled && input.hasSourceMedia) return "in_progress";
  return "orphan";
}

export function isPubliclyCurated(occupancy: UniverseOccupancy): boolean {
  return occupancy === "curated";
}

export function isAssociateTarget(occupancy: UniverseOccupancy): boolean {
  return occupancy === "curated" || occupancy === "in_progress";
}

export function occupancyLabel(occupancy: UniverseOccupancy): string {
  if (occupancy === "curated") return "Curated";
  if (occupancy === "in_progress") return "In progress";
  if (occupancy === "withdrawn") return "Withdrawn";
  return "Orphan";
}

export function hasSourceMediaFromSession(input: {
  phase: string | null | undefined;
  assetId: string | null | undefined;
}): boolean {
  if (!input.assetId) return false;
  return input.phase === "ingested" || input.phase === "ready" || input.phase === "uploading" || input.phase === "processing";
}

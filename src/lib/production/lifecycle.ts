/**
 * Production artifact lifecycle.
 *
 * SOURCE → EVIDENCE → INTELLIGENCE → CURATED REFERENCE → PRODUCTION PLAN
 * → (future) REALIZATION → EXPERIENCE
 *
 * This module classifies existing records. It does not create tables.
 * Evidence and derived intelligence are never Gallery assets.
 *
 * MEDIA ≠ UNIVERSE. REFERENCE ≠ SCENE. REALIZATION ≠ CANONICAL TRUTH.
 */

export const CURATED_REFERENCE_PROVIDER = "curated-reference";
export const PRODUCTION_PROVIDER = "production";

export const REFERENCE_ROLES = [
  "still",
  "character",
  "environment",
  "motion",
  "composition",
  "style",
] as const;

export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export type LifecycleStage =
  | "canonical"
  | "source"
  | "evidence"
  | "intelligence"
  | "reference"
  | "plan"
  | "realization"
  | "projection";

export type GalleryAssetRole = "source" | "reference" | "production" | "other";

export const SOURCE_ASSET_TYPES = [
  "original",
  "video",
  "audio",
  "streaming-variant",
] as const;

export function isReferenceRole(value: string | null | undefined): value is ReferenceRole {
  return typeof value === "string" && (REFERENCE_ROLES as readonly string[]).includes(value);
}

export function isSourceAssetType(value: string | null | undefined): boolean {
  return typeof value === "string" && (SOURCE_ASSET_TYPES as readonly string[]).includes(value);
}

export function isCuratedReferenceProvider(provider: string | null | undefined): boolean {
  return provider === CURATED_REFERENCE_PROVIDER;
}

/**
 * Gallery catalogue role for a media_asset row.
 * Frame observations, storyboard beats, and inspection sessions are not media_asset rows.
 */
export function classifyGalleryAssetRole(asset: {
  provider?: string | null;
  asset_type?: string | null;
  storage_ref?: string | null;
}): GalleryAssetRole {
  if (asset.provider === CURATED_REFERENCE_PROVIDER) return "reference";
  if (asset.provider === PRODUCTION_PROVIDER) return "production";
  if (asset.storage_ref?.startsWith("seed:placeholder:")) return "other";
  if (isSourceAssetType(asset.asset_type)) return "source";
  return "other";
}

export function isGalleryProductionAsset(role: GalleryAssetRole): boolean {
  return role === "source" || role === "reference" || role === "production";
}

export function galleryRoleLabel(role: GalleryAssetRole): string {
  if (role === "source") return "Source";
  if (role === "reference") return "Reference";
  if (role === "production") return "Production";
  return "Other";
}

export function classifyLifecycleKind(kind: string): LifecycleStage {
  switch (kind) {
    case "universe":
    case "mural":
    case "scene":
    case "creative-moment":
    case "scene_moment":
      return "canonical";
    case "media_asset.source":
    case "delivery_variant":
      return "source";
    case "inspection_session":
    case "frame_observation":
      return "evidence";
    case "storyboard":
    case "animation_plan":
    case "boundary_proposal":
      return "intelligence";
    case "curated_reference":
      return "reference";
    case "production_plan":
      return "plan";
    case "media_realization":
    case "production_output":
      return "realization";
    case "projection":
    case "projection_media_binding":
    case "holographic":
    case "scene_deck":
      return "projection";
    default:
      return "intelligence";
  }
}

export function curatedReferenceIntegrityHash(input: {
  universe_id: string;
  source_asset_id: string;
  time_ms: number;
  role: ReferenceRole;
}): string {
  return `curated-reference:${input.universe_id}:${input.source_asset_id}:${input.time_ms}:${input.role}`;
}

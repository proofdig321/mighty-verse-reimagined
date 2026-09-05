/**
 * Mighty Verse Media Metadata — shared types.
 *
 * Authority hierarchy:
 *   1. Supabase canonical records  — authoritative source of truth
 *   2. Sidecar JSON                — portable canonical representation (derived, not authoritative)
 *   3. Embedded file metadata      — portable representation / ingestion evidence
 *   4. Provider metadata           — delivery/provider representation only
 *
 * Embedded metadata and sidecars are NEVER the canonical authority.
 * They are generated FROM canonical state and may be verified AGAINST it.
 */

export const METADATA_SCHEMA = "mighty-verse-media-metadata";
export const METADATA_VERSION = 1;

/** Media classes that determine which embedding strategy applies. */
export type MediaClass =
  | "audio-mp3"       // MP3 — ID3v2 embedding via node-id3
  | "audio-other"     // FLAC, WAV, M4A, AIFF — sidecar only (no native embedding without ffmpeg)
  | "video"           // MP4/MOV — sidecar only (Livepeer holds bytes; no direct embedding)
  | "image-raster"    // JPEG/PNG/WEBP/TIFF — EXIF/XMP via sharp
  | "image-other"     // SVG, GIF, etc. — sidecar only
  | "unknown";        // Unrecognised — sidecar only

/**
 * Canonical metadata representation derived from Supabase records.
 *
 * This object is generated FROM canonical state. It is NOT itself canonical.
 * The Supabase database remains the single source of truth.
 *
 * Field semantics:
 *   creator        — primary artist/performer credit from intake, or null if unavailable.
 *                    NOT automatically the rights holder. See rightsHolder/rightsHolderLabel.
 *   rightsHolder   — participant_id of the rights-controlling entity (stable identifier).
 *   rightsHolderLabel — display name of the rights holder (informational only).
 *
 * The distinction between creator/performer and rights holder is intentional.
 * A label may hold rights without being the performing artist.
 */
export type CanonicalMediaMetadata = {
  // Identity
  mediaAssetId: string;
  mediaRealizationId: string | null;
  masterId: string | null;

  // Work information
  title: string | null;
  /**
   * Primary artist/performer credit.
   * Sourced from media_intake_credit (primary_artist role) when available,
   * falling back to intake.creator_name.
   * NOT automatically the rights holder.
   * Null when no performer credit is available in canonical records.
   */
  creator: string | null;
  description: string | null;

  // Rights — distinct from creator/performer
  rightsHolder: string | null;      // participant_id — stable identifier
  rightsHolderLabel: string | null; // display name — informational only
  rightsBasis: string | null;
  copyrightYear: number | null;

  // Recording identity
  realizationType: string | null;
  versionLabel: string | null;

  // ISRC — only present when assigned and eligible
  isrc: string | null;
  isrcStatus: string | null;
  isrcRegistrantName: string | null;

  // Provenance
  metadataGeneratedAt: string;      // ISO 8601
  metadataVersion: number;
  metadataSchema: string;
};

/** Result of extracting metadata from an uploaded file buffer. */
export type ExtractedFileMetadata = {
  mediaClass: MediaClass;
  mimeType: string | null;

  // Fields found in the file
  title: string | null;
  artist: string | null;
  album: string | null;
  copyright: string | null;
  description: string | null;
  year: number | null;

  // ISRC found in the file — evidence, not authority
  embeddedIsrc: string | null;

  // Raw tag data for audit purposes
  rawTags: Record<string, unknown>;
};

/** Result of an embed/sidecar operation. */
export type MetadataEmbedResult = {
  mediaClass: MediaClass;
  embedded: boolean;           // true = written into file bytes (MP3/image only)
  sidecarStored: boolean;      // true = portable canonical representation stored in media-metadata bucket
  sidecarPath: string | null;  // storage path if stored
  /**
   * SHA-256 hash of the canonical metadata JSON (excluding metadataGeneratedAt).
   * This is a CONTENT HASH of the canonical metadata representation.
   * It is NOT a hash of the media file bytes.
   * Used to detect whether the sidecar is stale relative to canonical state.
   */
  contentHash: string;
  warnings: string[];
};

/** Consistency check between canonical and embedded/sidecar metadata. */
export type MetadataConsistencyReport = {
  assetId: string;
  canonicalIsrc: string | null;
  embeddedIsrc: string | null;
  sidecarIsrc: string | null;
  isrcConsistent: boolean;
  sidecarPresent: boolean;
  sidecarStale: boolean;       // true if sidecar hash != current canonical hash
  sidecarHash: string | null;
  currentHash: string | null;
};

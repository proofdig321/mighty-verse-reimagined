/**
 * Mighty Verse Media Metadata — shared types.
 *
 * The database (Supabase) is the canonical authority.
 * Embedded/sidecar metadata is a portable provenance representation.
 * These types describe both layers without conflating them.
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

/** Canonical metadata constructed from Supabase records. */
export type CanonicalMediaMetadata = {
  // Identity
  mediaAssetId: string;
  mediaRealizationId: string | null;
  masterId: string | null;

  // Work information
  title: string | null;
  creator: string | null;           // rights holder display label
  description: string | null;

  // Rights
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
  embedded: boolean;           // true = written into file bytes
  sidecarStored: boolean;      // true = sidecar JSON stored in media-metadata bucket
  sidecarPath: string | null;  // storage path if stored
  contentHash: string;         // SHA-256 of the canonical metadata JSON
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

/**
 * Metadata extraction from uploaded file buffers.
 *
 * Called BEFORE provider ingestion to detect existing metadata
 * (including embedded ISRCs) in uploaded files.
 *
 * Extracted metadata is evidence, not canonical authority.
 * An embedded ISRC must be reconciled against canonical state
 * by the Authority operator — never silently overwritten.
 */

import type { ExtractedFileMetadata, MediaClass } from "./metadata-types";

/**
 * Detect media class from MIME type and/or filename extension.
 *
 * Handles:
 *   - audio/mpeg, audio/mp3, .mp3                → audio-mp3
 *   - audio/* (FLAC, WAV, AIFF, M4A, OGG, OPUS)  → audio-other
 *   - application/ogg, .ogg, .opus               → audio-other (OGG container)
 *   - video/* (.mp4, .mov, .webm, .mkv)           → video
 *   - image/jpeg, image/png, image/webp, image/tiff → image-raster
 *   - image/gif, image/svg+xml, .svg, .gif        → image-other
 *   - everything else                             → unknown
 *
 * Note: file-type magic-byte detection is available via detectMediaClassFromBytes()
 * for server-side validation where the actual file buffer is available.
 */
export function detectMediaClass(mimeType: string | null, filename?: string): MediaClass {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = (filename ?? "").split(".").pop()?.toLowerCase() ?? "";

  if (mime === "audio/mpeg" || mime === "audio/mp3" || ext === "mp3") return "audio-mp3";
  if (
    mime.startsWith("audio/") ||
    // OGG containers: file-type returns application/ogg; browsers may send audio/ogg
    mime === "application/ogg" || mime === "video/ogg" ||
    ["flac", "wav", "aiff", "aif", "m4a", "aac", "ogg", "oga", "opus", "wma"].includes(ext)
  ) return "audio-other";
  if (
    mime === "video/mp4" || mime === "video/quicktime" || mime === "video/x-msvideo" ||
    mime.startsWith("video/") ||
    ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)
  ) return "video";
  if (
    mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" ||
    mime === "image/tiff" || ["jpg", "jpeg", "png", "webp", "tiff", "tif"].includes(ext)
  ) return "image-raster";
  if (mime.startsWith("image/") || ["gif", "svg", "bmp", "ico"].includes(ext)) return "image-other";
  return "unknown";
}

/**
 * Detect media class from actual file bytes using magic-byte detection.
 * More reliable than MIME/extension alone — detects spoofed or misnamed files.
 *
 * Falls back to detectMediaClass(mimeType, filename) if magic detection is
 * inconclusive (e.g. SVG, plain text, or very small buffers).
 *
 * Used server-side before provider ingestion to validate file content.
 */
export async function detectMediaClassFromBytes(
  buffer: Buffer,
  mimeType: string | null,
  filename?: string
): Promise<{ mediaClass: MediaClass; detectedMime: string | null; spoofed: boolean }> {
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  const detectedMime = detected?.mime ?? null;

  // If magic detection found something, use it as the authoritative signal
  if (detectedMime) {
    const magicClass = detectMediaClass(detectedMime, detected?.ext);
    const claimedClass = detectMediaClass(mimeType, filename);
    // Spoofed = claimed class differs from magic-detected class
    const spoofed = claimedClass !== magicClass && claimedClass !== "unknown";
    return { mediaClass: magicClass, detectedMime, spoofed };
  }

  // Magic inconclusive (SVG, plain text, etc.) — fall back to MIME/extension
  return { mediaClass: detectMediaClass(mimeType, filename), detectedMime: null, spoofed: false };
}

/**
 * Extract metadata from an uploaded file buffer.
 * Returns extracted fields and any embedded ISRC as evidence.
 *
 * Supports:
 *   MP3 — ID3v2/ID3v1 via music-metadata
 *   Other audio — music-metadata where supported
 *   Images — EXIF/XMP via sharp
 *   Video/unknown — basic MIME detection only (no binary tools available)
 */
export async function extractFileMetadata(
  buffer: Buffer,
  mimeType: string | null,
  filename?: string
): Promise<ExtractedFileMetadata> {
  const mediaClass = detectMediaClass(mimeType, filename);
  const base: ExtractedFileMetadata = {
    mediaClass,
    mimeType,
    title: null,
    artist: null,
    album: null,
    copyright: null,
    description: null,
    year: null,
    embeddedIsrc: null,
    rawTags: {},
  };

  try {
    if (mediaClass === "audio-mp3" || mediaClass === "audio-other") {
      return await extractAudioMetadata(buffer, base);
    }
    if (mediaClass === "image-raster") {
      return await extractImageMetadata(buffer, base);
    }
  } catch (err) {
    // Extraction failure is non-fatal — return base with warning in rawTags
    base.rawTags["_extractionError"] = err instanceof Error ? err.message : String(err);
  }

  return base;
}

async function extractAudioMetadata(
  buffer: Buffer,
  base: ExtractedFileMetadata
): Promise<ExtractedFileMetadata> {
  // music-metadata is pure JS, works on Vercel, supports MP3/FLAC/WAV/M4A/OGG
  const mm = await import("music-metadata");
  const parsed = await mm.parseBuffer(buffer, base.mimeType ?? undefined, { duration: false });
  const common = parsed.common;

  const isrc = common.isrc?.[0] ?? null;
  const year = common.year ?? null;

  return {
    ...base,
    title: common.title ?? null,
    artist: common.artist ?? null,
    album: common.album ?? null,
    copyright: common.copyright ?? null,
    description: (common.comment?.[0] && typeof common.comment[0] === 'string' ? common.comment[0] : null),
    year: typeof year === "number" ? year : null,
    embeddedIsrc: isrc ?? null,
    rawTags: {
      format: parsed.format.container ?? null,
      codec: parsed.format.codec ?? null,
      bitrate: parsed.format.bitrate ?? null,
      sampleRate: parsed.format.sampleRate ?? null,
      channels: parsed.format.numberOfChannels ?? null,
      duration: parsed.format.duration ?? null,
      trackNumber: common.track?.no ?? null,
      genre: common.genre?.[0] ?? null,
      isrcAll: common.isrc ?? [],
    },
  };
}

async function extractImageMetadata(
  buffer: Buffer,
  base: ExtractedFileMetadata
): Promise<ExtractedFileMetadata> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buffer).metadata();

  const rawTags: Record<string, unknown> = {
    format: meta.format ?? null,
    width: meta.width ?? null,
    height: meta.height ?? null,
    space: meta.space ?? null,
    hasAlpha: meta.hasAlpha ?? null,
    density: meta.density ?? null,
    hasProfile: meta.hasProfile ?? null,
  };

  // Extract XMP if present — may contain dc:title, dc:creator, xmpRights:WebStatement
  if (meta.xmp) {
    const xmpStr = meta.xmp.toString("utf8");
    rawTags["xmp"] = xmpStr.slice(0, 500); // truncate for storage
    const titleMatch = xmpStr.match(/<dc:title[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/);
    if (titleMatch) base.title = titleMatch[1].trim();
    const creatorMatch = xmpStr.match(/<dc:creator[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/);
    if (creatorMatch) base.artist = creatorMatch[1].trim();
  }

  // Extract EXIF if present
  if (meta.exif) {
    rawTags["exifPresent"] = true;
    rawTags["exifLength"] = meta.exif.length;
  }

  return { ...base, rawTags };
}

/**
 * Detect a potential ISRC conflict between an uploaded file and canonical state.
 * Returns a structured conflict description if a mismatch is found.
 */
export function detectIsrcConflict(
  extracted: ExtractedFileMetadata,
  canonicalIsrc: string | null
): { conflict: boolean; embeddedIsrc: string | null; canonicalIsrc: string | null; description: string } {
  const embedded = extracted.embeddedIsrc;

  if (!embedded && !canonicalIsrc) {
    return { conflict: false, embeddedIsrc: null, canonicalIsrc: null, description: "No ISRC in file or canonical record" };
  }
  if (!embedded && canonicalIsrc) {
    return { conflict: false, embeddedIsrc: null, canonicalIsrc, description: "Canonical ISRC exists; file has none" };
  }
  if (embedded && !canonicalIsrc) {
    return { conflict: false, embeddedIsrc: embedded, canonicalIsrc: null, description: "File contains ISRC evidence; no canonical ISRC yet — operator should review" };
  }
  // Both present
  const normalise = (s: string) => s.toUpperCase().replace(/-/g, "");
  if (normalise(embedded!) === normalise(canonicalIsrc!)) {
    return { conflict: false, embeddedIsrc: embedded, canonicalIsrc, description: "Embedded ISRC matches canonical" };
  }
  return {
    conflict: true,
    embeddedIsrc: embedded,
    canonicalIsrc,
    description: `ISRC conflict: file contains ${embedded}, canonical record has ${canonicalIsrc}. Operator must resolve.`,
  };
}

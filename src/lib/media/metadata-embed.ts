/**
 * Metadata embedding and sidecar storage.
 *
 * Embedding strategy by media class:
 *   audio-mp3      → ID3v2 tags via node-id3 (TSRC for ISRC, TIT2, TPE1, TCOP)
 *   audio-other    → sidecar only (no ffmpeg available)
 *   video          → sidecar only (Livepeer holds bytes; no direct access)
 *   image-raster   → XMP via sharp (dc:title, dc:creator, xmpRights, plus sidecar)
 *   image-other    → sidecar only
 *   unknown        → sidecar only
 *
 * Sidecar storage:
 *   Supabase Storage bucket: media-metadata
 *   Path: {assetId}/metadata.json
 *   Content: CanonicalMediaMetadata JSON
 *
 * The database remains canonical. Embedded/sidecar metadata is a
 * portable provenance representation derived from canonical records.
 */

import { createClient } from "@supabase/supabase-js";
import type { CanonicalMediaMetadata, MediaClass, MetadataEmbedResult, MetadataConsistencyReport } from "./metadata-types";
import { hashCanonicalMetadata } from "./metadata-build";
import { formatIsrcDisplay } from "./isrc";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SIDECAR_BUCKET = "media-metadata";

// ─── Sidecar ─────────────────────────────────────────────────────────────────

/** Store or update the sidecar JSON for an asset. */
async function storeSidecar(
  assetId: string,
  meta: CanonicalMediaMetadata,
  contentHash: string
): Promise<{ path: string | null; error: string | null }> {
  const svc = getServiceClient();
  const path = `${assetId}/metadata.json`;
  const body = JSON.stringify({ ...meta, _contentHash: contentHash }, null, 2);

  const { error } = await svc.storage
    .from(SIDECAR_BUCKET)
    .upload(path, Buffer.from(body, "utf8"), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

/** Read the sidecar JSON for an asset. Returns null if not found. */
export async function readSidecar(assetId: string): Promise<(CanonicalMediaMetadata & { _contentHash?: string }) | null> {
  const svc = getServiceClient();
  const { data, error } = await svc.storage
    .from(SIDECAR_BUCKET)
    .download(`${assetId}/metadata.json`);

  if (error || !data) return null;
  try {
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── MP3 ID3 embedding ────────────────────────────────────────────────────────

/**
 * Write ID3v2 tags into an MP3 buffer.
 * Returns the modified buffer.
 *
 * Tags written:
 *   TIT2 — title
 *   TPE1 — artist/creator
 *   TALB — album (work title / master title)
 *   TCOP — copyright
 *   TSRC — ISRC (only when assigned and eligible)
 *   COMM — provenance comment with Mighty Verse asset ID
 */
export async function embedMp3Metadata(
  buffer: Buffer,
  meta: CanonicalMediaMetadata
): Promise<Buffer> {
  const NodeID3 = (await import("node-id3")).default;

  // Read existing tags first — preserve fields we don't overwrite
  const existing = NodeID3.read(buffer) as Record<string, unknown>;

  const tags: Record<string, unknown> = {
    ...existing,
    title: meta.title ?? (existing.title as string | undefined) ?? undefined,
    artist: meta.creator ?? (existing.artist as string | undefined) ?? undefined,
    album: meta.title ?? (existing.album as string | undefined) ?? undefined,
    copyright: meta.rightsBasis
      ? `${meta.copyrightYear ?? ""} ${meta.rightsHolderLabel ?? meta.rightsHolder ?? ""}`.trim()
      : (existing.copyright as string | undefined) ?? undefined,
    comment: {
      language: "eng",
      shortText: "Mighty Verse",
      text: `Mighty Verse asset: ${meta.mediaAssetId}${meta.mediaRealizationId ? ` | realization: ${meta.mediaRealizationId}` : ""}`,
    },
  };

  // ISRC — only embed when canonically assigned
  // node-id3 writes TSRC frame; reads it back as 'ISRC' key
  if (meta.isrc) {
    tags["TSRC"] = meta.isrc;
  } else {
    // Preserve existing ISRC evidence if present and no canonical ISRC yet
    const existingIsrc = (existing as Record<string, unknown>)["ISRC"];
    if (existingIsrc) tags["TSRC"] = existingIsrc;
  }

  const result = NodeID3.write(tags as Parameters<typeof NodeID3.write>[0], buffer);
  // node-id3 write returns Buffer on success, false on failure
  const writeResult = result as unknown as Buffer | false;
  if (writeResult === false) throw new Error("node-id3: failed to write tags");
  return Buffer.isBuffer(writeResult) ? writeResult : Buffer.from(writeResult as unknown as Uint8Array);
}

// ─── Image XMP embedding ──────────────────────────────────────────────────────

/**
 * Write XMP metadata into a raster image buffer via sharp.
 * Returns the modified buffer in the same format.
 *
 * XMP fields written:
 *   dc:title
 *   dc:creator
 *   dc:description
 *   xmpRights:WebStatement (rights basis)
 *   xmp:Identifier (Mighty Verse asset ID)
 */
export async function embedImageMetadata(
  buffer: Buffer,
  meta: CanonicalMediaMetadata,
  outputFormat?: "jpeg" | "png" | "webp" | "tiff"
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  const xmp = buildXmp(meta);

  const pipeline = sharp(buffer).withXmp(xmp);

  if (outputFormat) {
    return pipeline.toFormat(outputFormat).toBuffer();
  }
  return pipeline.toBuffer();
}

function buildXmp(meta: CanonicalMediaMetadata): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const title = meta.title ? escape(meta.title) : "";
  const creator = meta.creator ? escape(meta.creator) : "";
  const description = meta.description ? escape(meta.description) : "";
  const rights = meta.rightsBasis ? escape(meta.rightsBasis) : "";
  const assetId = escape(meta.mediaAssetId);
  const isrcLine = meta.isrc
    ? `    <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture</Iptc4xmpExt:DigitalSourceType>\n    <plus:ImageSupplierImageID>${escape(meta.isrc)}</plus:ImageSupplierImageID>\n`
    : "";

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
      xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/">
${title ? `      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>\n` : ""}${creator ? `      <dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>\n` : ""}${description ? `      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt></dc:description>\n` : ""}${rights ? `      <xmpRights:WebStatement>${rights}</xmpRights:WebStatement>\n` : ""}      <xmp:Identifier>mighty-verse:asset:${assetId}</xmp:Identifier>
${isrcLine}    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// ─── Main orchestration ───────────────────────────────────────────────────────

/**
 * Embed metadata into a file buffer and store a sidecar.
 *
 * For Livepeer-hosted video/audio-other: sidecar only (we don't hold bytes).
 * For MP3 buffers: ID3v2 embedding + sidecar.
 * For raster images: XMP embedding + sidecar.
 *
 * Returns the (possibly modified) buffer and the embed result.
 */
export async function embedMetadata(
  buffer: Buffer,
  mediaClass: MediaClass,
  meta: CanonicalMediaMetadata
): Promise<{ buffer: Buffer; result: MetadataEmbedResult }> {
  const warnings: string[] = [];
  const contentHash = hashCanonicalMetadata(meta);
  let embedded = false;
  let outputBuffer = buffer;

  // Attempt native embedding
  if (mediaClass === "audio-mp3") {
    try {
      outputBuffer = await embedMp3Metadata(buffer, meta);
      embedded = true;
    } catch (err) {
      warnings.push(`MP3 ID3 embedding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (mediaClass === "image-raster") {
    try {
      outputBuffer = await embedImageMetadata(buffer, meta);
      embedded = true;
    } catch (err) {
      warnings.push(`Image XMP embedding failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (mediaClass === "video") {
    warnings.push("Video: native metadata embedding requires ffmpeg which is not available in this environment. Sidecar stored.");
  } else if (mediaClass === "audio-other") {
    warnings.push(`${mediaClass}: native embedding requires ffmpeg. Sidecar stored.`);
  }

  // Always store sidecar
  const { path: sidecarPath, error: sidecarError } = await storeSidecar(meta.mediaAssetId, meta, contentHash);
  if (sidecarError) warnings.push(`Sidecar storage failed: ${sidecarError}`);

  return {
    buffer: outputBuffer,
    result: {
      mediaClass,
      embedded,
      sidecarStored: !sidecarError,
      sidecarPath,
      contentHash,
      warnings,
    },
  };
}

// ─── Consistency check ────────────────────────────────────────────────────────

/**
 * Check consistency between canonical metadata and stored sidecar.
 * Used by the Authority UI to show metadata status.
 */
export async function checkMetadataConsistency(
  assetId: string,
  canonicalMeta: CanonicalMediaMetadata
): Promise<MetadataConsistencyReport> {
  const sidecar = await readSidecar(assetId);
  const currentHash = hashCanonicalMetadata(canonicalMeta);
  const sidecarHash = sidecar?._contentHash ?? null;

  return {
    assetId,
    canonicalIsrc: canonicalMeta.isrc,
    embeddedIsrc: null, // Cannot read from Livepeer HLS; would require original file
    sidecarIsrc: sidecar?.isrc ?? null,
    isrcConsistent: !sidecar || sidecar.isrc === canonicalMeta.isrc,
    sidecarPresent: !!sidecar,
    sidecarStale: !!sidecar && sidecarHash !== currentHash,
    sidecarHash,
    currentHash,
  };
}

/**
 * Synchronise sidecar after canonical metadata changes (e.g. ISRC assignment).
 * Idempotent — safe to call multiple times.
 */
export async function syncSidecar(assetId: string, meta: CanonicalMediaMetadata): Promise<MetadataEmbedResult> {
  const contentHash = hashCanonicalMetadata(meta);
  const { path, error } = await storeSidecar(assetId, meta, contentHash);
  const warnings = error ? [`Sidecar sync failed: ${error}`] : [];
  return {
    mediaClass: "unknown",
    embedded: false,
    sidecarStored: !error,
    sidecarPath: path,
    contentHash,
    warnings,
  };
}

/** Format ISRC for display in metadata (with hyphens). */
export { formatIsrcDisplay };

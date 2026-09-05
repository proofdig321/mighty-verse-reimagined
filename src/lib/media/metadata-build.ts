/**
 * Canonical metadata construction.
 *
 * Builds a CanonicalMediaMetadata representation from Supabase records.
 * The Supabase database is the canonical authority.
 * This object is a derived representation — not itself canonical.
 *
 * Creator/performer vs rights holder:
 *   creator field — primary artist/performer from intake credits or intake.creator_name.
 *                    NOT automatically the rights holder.
 *   rightsHolder   — the rights-controlling participant (may differ from performer).
 *
 * ISRC is only included when:
 *   - media_realization exists
 *   - realization_type is ISRC-eligible
 *   - rights_holder_ref is set
 *   - isrc is assigned
 *
 * Realization relationship priority:
 *   media_asset.realization_id — direct association (set at ingest or explicitly)
 *   projection_media_binding.realization_id — contextual/binding association (fallback)
 * When both exist and differ, media_asset.realization_id takes precedence.
 */

import { createClient } from "@supabase/supabase-js";
import { isIsrcEligible } from "./isrc";
import type { CanonicalMediaMetadata } from "./metadata-types";
import { METADATA_SCHEMA, METADATA_VERSION } from "./metadata-types";
import { createHash } from "crypto";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Build a canonical metadata representation for a media_asset.
 * Loads all required records from Supabase.
 * Returns null if the asset does not exist.
 *
 * Realization lookup priority:
 *   1. media_asset.realization_id (direct association)
 *   2. projection_media_binding.realization_id (contextual, primary binding only)
 * If both exist and differ, the direct association wins.
 *
 * Creator field:
 *   Sourced from media_intake_credit (primary_artist role) when available,
 *   then intake.creator_name. NOT the rights holder unless they are also the credited artist.
 */
export async function buildCanonicalMetadata(assetId: string): Promise<CanonicalMediaMetadata | null> {
  const svc = getServiceClient();

  // Load asset
  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, rights_holder_ref, rights_basis, realization_id, intake_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return null;

  // Load realization: direct association takes precedence over binding association
  let realization: {
    realization_id: string; master_id: string; realization_type: string;
    rights_holder_ref: string | null; rights_basis: string | null;
    isrc: string | null; isrc_status: string | null; version_label: string | null;
  } | null = null;

  if (asset.realization_id) {
    const { data } = await svc
      .from("media_realization")
      .select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, isrc, isrc_status, version_label")
      .eq("realization_id", asset.realization_id)
      .maybeSingle();
    realization = data ?? null;
  }

  // Determine master_id — from direct realization or via primary binding
  let masterId: string | null = realization?.master_id ?? null;
  let bindingRealizationId: string | null = null;

  if (!masterId) {
    const { data: binding } = await svc
      .from("projection_media_binding")
      .select("projection_id, realization_id, projection!inner(master_id)")
      .eq("asset_id", assetId)
      .eq("binding_type", "primary")
      .limit(1)
      .maybeSingle();
    if (binding) {
      const proj = binding.projection as unknown as { master_id: string } | null;
      masterId = proj?.master_id ?? null;
      bindingRealizationId = binding.realization_id ?? null;
    }
  }

  // If no direct realization but binding has one, load it
  if (!realization && bindingRealizationId) {
    const { data } = await svc
      .from("media_realization")
      .select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, isrc, isrc_status, version_label")
      .eq("realization_id", bindingRealizationId)
      .maybeSingle();
    realization = data ?? null;
    if (realization?.master_id) masterId = realization.master_id;
  }

  // Load presentation for title/description
  const { data: presentation } = masterId
    ? await svc
        .from("work_presentation")
        .select("title, description")
        .eq("master_id", masterId)
        .maybeSingle()
    : { data: null };

  // Load intake for title/creator fallback
  const { data: intake } = asset.intake_id
    ? await svc
        .from("media_intake")
        .select("intake_id, title, creator_name, description")
        .eq("intake_id", asset.intake_id)
        .maybeSingle()
    : { data: null };

  // Resolve primary artist credit from intake credits
  // This is the performer/artist, NOT automatically the rights holder
  let primaryArtistCredit: string | null = null;
  if (intake?.intake_id) {
    const { data: credits } = await svc
      .from("media_intake_credit")
      .select("participant_id, role")
      .eq("intake_id", intake.intake_id)
      .eq("role", "primary_artist")
      .limit(1)
      .maybeSingle();
    if (credits?.participant_id) {
      const { data: artistParticipant } = await svc
        .from("participant")
        .select("participant_id, identity_link(identity_ref, active)")
        .eq("participant_id", credits.participant_id)
        .maybeSingle();
      if (artistParticipant) {
        const links = artistParticipant.identity_link as { identity_ref: string; active: boolean }[] | null;
        primaryArtistCredit = links?.find(l => l.active)?.identity_ref ?? null;
      }
    }
  }

  // Resolve rights holder label (separate from creator/performer)
  const rightsHolderRef = realization?.rights_holder_ref ?? asset.rights_holder_ref ?? null;
  let rightsHolderLabel: string | null = null;
  if (rightsHolderRef) {
    const { data: participant } = await svc
      .from("participant")
      .select("participant_id, identity_link(identity_ref, active)")
      .eq("participant_id", rightsHolderRef)
      .maybeSingle();
    if (participant) {
      const links = participant.identity_link as { identity_ref: string; active: boolean }[] | null;
      rightsHolderLabel = links?.find(l => l.active)?.identity_ref ?? null;
    }
  }

  // Load active ISRC registrant name if ISRC is assigned
  let isrcRegistrantName: string | null = null;
  if (realization?.isrc) {
    const { data: logEntry } = await svc
      .from("isrc_assignment_log")
      .select("registrant_id, isrc_registrant(registrant_name)")
      .eq("realization_id", realization.realization_id)
      .eq("isrc", realization.isrc)
      .limit(1)
      .maybeSingle();
    if (logEntry) {
      const reg = logEntry.isrc_registrant as unknown as { registrant_name: string } | null;
      isrcRegistrantName = reg?.registrant_name ?? null;
    }
  }

  // ISRC is only included when all prerequisites are met
  const isrcEligible = realization ? isIsrcEligible(realization.realization_type) : false;
  const hasRights = !!(realization?.rights_holder_ref ?? asset.rights_holder_ref);
  const isrc = isrcEligible && hasRights && realization?.isrc ? realization.isrc : null;

  const title = presentation?.title ?? intake?.title ?? null;
  // creator = primary artist credit, then intake creator_name, then null
  // NOT the rights holder — these are distinct concepts
  const creator = primaryArtistCredit ?? intake?.creator_name ?? null;
  const description = presentation?.description ?? intake?.description ?? null;
  const copyrightYear = new Date().getFullYear();

  return {
    mediaAssetId: assetId,
    mediaRealizationId: realization?.realization_id ?? null,
    masterId,
    title,
    creator,
    description,
    rightsHolder: rightsHolderRef,
    rightsHolderLabel,
    rightsBasis: realization?.rights_basis ?? asset.rights_basis ?? null,
    copyrightYear,
    realizationType: realization?.realization_type ?? null,
    versionLabel: realization?.version_label ?? null,
    isrc,
    isrcStatus: realization?.isrc_status ?? null,
    isrcRegistrantName,
    metadataGeneratedAt: new Date().toISOString(),
    metadataVersion: METADATA_VERSION,
    metadataSchema: METADATA_SCHEMA,
  };
}

/**
 * Compute a deterministic SHA-256 hash of the canonical metadata representation.
 * Used to detect whether the sidecar is stale relative to canonical state.
 *
 * This is a CONTENT HASH of the canonical metadata JSON.
 * It is NOT a hash of the media file bytes.
 * Excludes metadataGeneratedAt (timestamp) so the hash reflects content, not generation time.
 */
export function hashCanonicalMetadata(meta: CanonicalMediaMetadata): string {
  const { metadataGeneratedAt: _ts, ...stable } = meta;
  const canonical = JSON.stringify(stable, Object.keys(stable).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

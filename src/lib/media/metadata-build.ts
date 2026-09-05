/**
 * Canonical metadata construction.
 *
 * Builds a CanonicalMediaMetadata object from Supabase records.
 * This is the single source of truth for what gets embedded or stored in sidecars.
 *
 * Only includes ISRC when:
 *   - media_realization exists
 *   - realization_type is ISRC-eligible
 *   - rights_holder_ref is set
 *   - isrc is assigned
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
 * Build canonical metadata for a media_asset.
 * Loads all required records from Supabase.
 * Returns null if the asset does not exist.
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

  // Load realization if linked
  const { data: realization } = asset.realization_id
    ? await svc
        .from("media_realization")
        .select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, isrc, isrc_status, version_label")
        .eq("realization_id", asset.realization_id)
        .maybeSingle()
    : { data: null };

  // Determine master_id — from realization or via binding
  let masterId: string | null = realization?.master_id ?? null;
  if (!masterId) {
    const { data: binding } = await svc
      .from("projection_media_binding")
      .select("projection_id, projection!inner(master_id)")
      .eq("asset_id", assetId)
      .eq("binding_type", "primary")
      .limit(1)
      .maybeSingle();
    if (binding) {
      const proj = binding.projection as unknown as { master_id: string } | null;
      masterId = proj?.master_id ?? null;
    }
  }

  // Load presentation for title/description
  const { data: presentation } = masterId
    ? await svc
        .from("work_presentation")
        .select("title, description")
        .eq("master_id", masterId)
        .maybeSingle()
    : { data: null };

  // Load intake for title fallback
  const { data: intake } = asset.intake_id
    ? await svc
        .from("media_intake")
        .select("title, creator_name, description")
        .eq("intake_id", asset.intake_id)
        .maybeSingle()
    : { data: null };

  // Resolve rights holder label
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
  const isrcEligible = realization
    ? isIsrcEligible(realization.realization_type)
    : false;
  const hasRights = !!(realization?.rights_holder_ref ?? asset.rights_holder_ref);
  const isrc = isrcEligible && hasRights && realization?.isrc ? realization.isrc : null;

  const title = presentation?.title ?? intake?.title ?? null;
  const creator = rightsHolderLabel ?? intake?.creator_name ?? null;
  const description = presentation?.description ?? intake?.description ?? null;
  const copyrightYear = new Date().getFullYear(); // production year

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
 * Compute a deterministic SHA-256 hash of canonical metadata.
 * Used to detect staleness of embedded/sidecar metadata.
 * Excludes metadataGeneratedAt (timestamp) from the hash so the hash
 * reflects content, not generation time.
 */
export function hashCanonicalMetadata(meta: CanonicalMediaMetadata): string {
  const { metadataGeneratedAt: _ts, ...stable } = meta;
  const canonical = JSON.stringify(stable, Object.keys(stable).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

import { getServiceClient } from "@/lib/authority/validate";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";
import { CURATED_REFERENCE_PROVIDER, type CuratedReference } from "@/lib/production";
import { parseReferenceProvenance } from "@/lib/production/reference";
import type { ReferenceRole } from "@/lib/production/lifecycle";

export async function loadUniverseReferences(universeId: string): Promise<CuratedReference[]> {
  const svc = getServiceClient();
  const { data: intakes } = await svc
    .from("media_intake")
    .select("intake_id, asset_id, title, provenance_notes, master_id")
    .eq("master_id", universeId);

  const assetIds = [...new Set((intakes ?? []).map((row) => row.asset_id).filter(Boolean) as string[])];
  if (!assetIds.length) return [];

  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, storage_ref, format, duration_ms, provider, provider_asset_id")
    .in("asset_id", assetIds)
    .eq("provider", CURATED_REFERENCE_PROVIDER);

  const intakeByAsset = new Map((intakes ?? []).map((row) => [row.asset_id, row]));
  const references: CuratedReference[] = [];
  for (const asset of assets ?? []) {
    const intake = intakeByAsset.get(asset.asset_id);
    const provenance = parseReferenceProvenance(intake?.provenance_notes ?? null);
    const timeMs = provenance?.time_ms ?? asset.duration_ms ?? 0;
    const role = (provenance?.role ?? asset.format) as ReferenceRole;
    references.push({
      asset_id: asset.asset_id,
      title: intake?.title ?? "Curated reference",
      role: role === "character" || role === "environment" || role === "motion" || role === "composition" || role === "style" ? role : "still",
      time_ms: timeMs,
      still_url: asset.storage_ref ? muxThumbnailUrl(asset.storage_ref, Math.max(0, Math.floor(timeMs / 1000)), 640) : null,
      scene_master_id: provenance?.scene_master_id ?? null,
      moment_master_id: provenance?.moment_master_id ?? null,
      source_asset_id: provenance?.source_asset_id ?? asset.provider_asset_id ?? "",
      panel_id: provenance?.panel_id ?? null,
    });
  }
  return references.sort((a, b) => a.time_ms - b.time_ms);
}

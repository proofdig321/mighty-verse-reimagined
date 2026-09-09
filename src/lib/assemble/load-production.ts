import { getServiceClient } from "@/lib/authority/validate";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";
import { isProductionIntegrityHash } from "@/lib/production/lifecycle";
import type { SceneProductionResultCard } from "@/lib/production/plan";
import { parseProductionProvenance } from "@/lib/production/result";

export type LoadedProductionResult = SceneProductionResultCard & {
  title: string;
  duration_ms: number | null;
  executor_job_id: string | null;
  source_asset_id: string | null;
};

/**
 * Load Mux-delivered production results for a Universe.
 * Does not load curated references, Sentinel evidence, or canonical source media.
 */
export async function loadUniverseProductionResults(universeId: string): Promise<LoadedProductionResult[]> {
  const svc = getServiceClient();
  const { data: intakes } = await svc
    .from("media_intake")
    .select("intake_id, asset_id, title, provenance_notes, master_id")
    .eq("master_id", universeId);

  const assetIds = [...new Set((intakes ?? []).map((row) => row.asset_id).filter(Boolean) as string[])];
  if (!assetIds.length) return [];

  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, storage_ref, duration_ms, provider, provider_asset_id, integrity_hash")
    .in("asset_id", assetIds)
    .eq("provider", "mux");

  const intakeByAsset = new Map((intakes ?? []).map((row) => [row.asset_id, row]));
  const results: LoadedProductionResult[] = [];
  for (const asset of assets ?? []) {
    const intake = intakeByAsset.get(asset.asset_id);
    const provenance = parseProductionProvenance(intake?.provenance_notes ?? null);
    if (!provenance && !isProductionIntegrityHash(asset.integrity_hash)) continue;
    if (!provenance) continue;
    results.push({
      asset_id: asset.asset_id,
      scene_master_id: provenance.scene_master_id,
      title: intake?.title ?? "Production result",
      mux_asset_id: provenance.mux_asset_id,
      playback_id: asset.storage_ref ?? provenance.playback_id,
      still_url: asset.storage_ref
        ? muxThumbnailUrl(asset.storage_ref, 0, 640)
        : provenance.playback_id
          ? muxThumbnailUrl(provenance.playback_id, 0, 640)
          : null,
      approval: provenance.approval,
      attached: provenance.attached,
      executor: provenance.executor,
      executor_job_id: provenance.executor_job_id,
      duration_ms: asset.duration_ms,
      source_asset_id: provenance.source_asset_id,
    });
  }
  return results;
}

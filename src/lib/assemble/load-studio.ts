import { getServiceClient } from "@/lib/authority/validate";
import { deriveMediaReadiness } from "@/lib/media/readiness";
import { associateAssetWithCanonicalWork, type CurateStudioMedia, type StudioInspectionSummary } from "./studio";

export type CurateStudioUniverse = {
  master_id: string;
  title: string | null;
};

/**
 * Load incoming media for Curate Studio. Reuses existing intake, readiness,
 * inspection_session, and projection_media_binding tables. No new state machine.
 */
export async function loadCurateStudioMedia(): Promise<{
  media: CurateStudioMedia[];
  universes: CurateStudioUniverse[];
}> {
  const svc = getServiceClient();

  const [{ data: universeMasters }, { data: rawAssets }, { data: intakes }] = await Promise.all([
    svc.from("master").select("master_id").eq("canonical_type", "universe").order("created_at", { ascending: true }),
    svc
      .from("media_asset")
      .select("asset_id, provider, storage_ref, duration_ms, rights_holder_ref, asset_type, intake_id")
      .in("asset_type", ["original", "streaming-variant"])
      .not("storage_ref", "like", "seed:placeholder:%")
      .order("created_at", { ascending: false }),
    svc.from("media_intake").select("intake_id, asset_id, title, work_type, isrc_status"),
  ]);

  const universeIds = (universeMasters ?? []).map((row) => row.master_id);
  const { data: universePres } = universeIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", universeIds)
    : { data: [] };

  const universes: CurateStudioUniverse[] = (universeMasters ?? []).map((row) => ({
    master_id: row.master_id,
    title: (universePres ?? []).find((pres) => pres.master_id === row.master_id)?.title ?? null,
  }));

  const assets = rawAssets ?? [];
  const assetIds = assets.map((asset) => asset.asset_id);

  const intakeIds = (intakes ?? []).map((intake) => intake.intake_id);
  const [{ data: creditRows }, { data: bindings }, { data: sessions }] = await Promise.all([
    intakeIds.length
      ? svc.from("media_intake_credit").select("intake_id").in("intake_id", intakeIds)
      : Promise.resolve({ data: [] }),
    assetIds.length
      ? svc.from("projection_media_binding").select("asset_id, projection_id").in("asset_id", assetIds)
      : Promise.resolve({ data: [] }),
    assetIds.length
      ? svc
          .from("inspection_session")
          .select("asset_id, status, candidate_count, started_at")
          .in("asset_id", assetIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const projIds = [...new Set((bindings ?? []).map((binding) => binding.projection_id))];
  const { data: projections } = projIds.length
    ? await svc.from("projection").select("projection_id, master_id").in("projection_id", projIds)
    : { data: [] };

  const boundMasterIds = [...new Set((projections ?? []).map((projection) => projection.master_id))];
  const { data: boundMasters } = boundMasterIds.length
    ? await svc.from("master").select("master_id, canonical_type, parent_master_id").in("master_id", boundMasterIds)
    : { data: [] };

  const parentIds = [...new Set((boundMasters ?? []).map((master) => master.parent_master_id).filter(Boolean) as string[])];
  const { data: parentMasters } = parentIds.length
    ? await svc.from("master").select("master_id, canonical_type, parent_master_id").in("master_id", parentIds)
    : { data: [] };

  const grandparentIds = [...new Set((parentMasters ?? []).map((master) => master.parent_master_id).filter(Boolean) as string[])];
  const { data: grandparentMasters } = grandparentIds.length
    ? await svc.from("master").select("master_id, canonical_type, parent_master_id").in("master_id", grandparentIds)
    : { data: [] };

  const allMasters = [...(boundMasters ?? []), ...(parentMasters ?? []), ...(grandparentMasters ?? [])];
  const uniqueMasters = [...new Map(allMasters.map((master) => [master.master_id, master])).values()];
  const titleIds = uniqueMasters.map((master) => master.master_id);
  const { data: presentations } = titleIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", titleIds)
    : { data: [] };

  const credits = new Set((creditRows ?? []).map((row) => row.intake_id));
  const intakeByAsset = new Map(
    (intakes ?? []).filter((intake) => intake.asset_id).map((intake) => [intake.asset_id as string, intake]),
  );

  const latestInspection = new Map<string, StudioInspectionSummary>();
  for (const session of sessions ?? []) {
    if (latestInspection.has(session.asset_id)) continue;
    latestInspection.set(session.asset_id, {
      status: session.status,
      candidate_count: session.candidate_count,
      started_at: session.started_at,
    });
  }

  const media: CurateStudioMedia[] = assets.map((asset) => {
    const intake = intakeByAsset.get(asset.asset_id);
    const readiness = deriveMediaReadiness({
      hasAsset: true,
      isPlaceholder: false,
      hasRights: Boolean(asset.rights_holder_ref),
      hasCredits: intake ? credits.has(intake.intake_id) : false,
      isrcStatus: intake?.isrc_status ?? null,
      workType: intake?.work_type ?? null,
    });
    return {
      asset_id: asset.asset_id,
      title: intake?.title ?? null,
      provider: asset.provider,
      storage_ref: asset.storage_ref,
      duration_ms: asset.duration_ms,
      work_type: intake?.work_type ?? null,
      readiness_overall: readiness.overall,
      readiness_blockers: readiness.blockers,
      inspection: latestInspection.get(asset.asset_id) ?? null,
      association: associateAssetWithCanonicalWork({
        assetId: asset.asset_id,
        bindings: bindings ?? [],
        projections: projections ?? [],
        masters: uniqueMasters,
        presentations: presentations ?? [],
      }),
    };
  });

  return { media, universes };
}

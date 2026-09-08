import { getServiceClient } from "@/lib/authority/validate";
import { deriveMediaReadiness } from "@/lib/media/readiness";
import { buildUniverseAssociationTarget, type UniverseAssociationTarget } from "./association";
import { associateAssetWithCanonicalWork, type CurateStudioMedia, type StudioInspectionSummary } from "./studio";

export type CurateStudioUniverse = {
  master_id: string;
  title: string | null;
  target: UniverseAssociationTarget;
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

  const { data: muralMasters } = universeIds.length
    ? await svc
        .from("master")
        .select("master_id, parent_master_id, created_at")
        .eq("canonical_type", "mural")
        .in("parent_master_id", universeIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const muralIds = (muralMasters ?? []).map((row) => row.master_id);
  const [{ data: muralPres }, { data: muralProjs }] = muralIds.length
    ? await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", muralIds),
        svc.from("projection").select("projection_id, master_id, created_at").in("master_id", muralIds).order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const muralProjIds = (muralProjs ?? []).map((row) => row.projection_id);
  const { data: muralBindings } = muralProjIds.length
    ? await svc
        .from("projection_media_binding")
        .select("projection_id, asset_id")
        .in("projection_id", muralProjIds)
        .eq("binding_type", "primary")
    : { data: [] };

  const universes: CurateStudioUniverse[] = (universeMasters ?? []).map((row) => {
    const title = (universePres ?? []).find((pres) => pres.master_id === row.master_id)?.title ?? null;
    const mural = (muralMasters ?? []).find((item) => item.parent_master_id === row.master_id) ?? null;
    const projection = mural
      ? (muralProjs ?? []).find((item) => item.master_id === mural.master_id) ?? null
      : null;
    const binding = projection
      ? (muralBindings ?? []).find((item) => item.projection_id === projection.projection_id) ?? null
      : null;
    return {
      master_id: row.master_id,
      title,
      target: buildUniverseAssociationTarget({
        universeId: row.master_id,
        universeTitle: title,
        mural: mural
          ? {
              master_id: mural.master_id,
              title: (muralPres ?? []).find((pres) => pres.master_id === mural.master_id)?.title ?? null,
            }
          : null,
        projectionId: projection?.projection_id ?? null,
        boundAssetId: binding?.asset_id ?? null,
      }),
    };
  });

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

/**
 * Server-side Universe → Mural → projection resolution.
 * Does not create masters, projections, or bindings.
 */
export async function loadUniverseAssociationTarget(universeId: string): Promise<UniverseAssociationTarget | null> {
  const svc = getServiceClient();
  const { data: universe } = await svc
    .from("master")
    .select("master_id")
    .eq("master_id", universeId)
    .eq("canonical_type", "universe")
    .maybeSingle();
  if (!universe) return null;

  const { data: universePres } = await svc
    .from("work_presentation")
    .select("title")
    .eq("master_id", universeId)
    .maybeSingle();

  const { data: mural } = await svc
    .from("master")
    .select("master_id, parent_master_id")
    .eq("canonical_type", "mural")
    .eq("parent_master_id", universeId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!mural) {
    return buildUniverseAssociationTarget({
      universeId,
      universeTitle: universePres?.title ?? null,
      mural: null,
      projectionId: null,
      boundAssetId: null,
    });
  }

  const [{ data: muralPres }, { data: projection }] = await Promise.all([
    svc.from("work_presentation").select("title").eq("master_id", mural.master_id).maybeSingle(),
    svc
      .from("projection")
      .select("projection_id")
      .eq("master_id", mural.master_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: binding } = projection
    ? await svc
        .from("projection_media_binding")
        .select("asset_id")
        .eq("projection_id", projection.projection_id)
        .eq("binding_type", "primary")
        .maybeSingle()
    : { data: null };

  return buildUniverseAssociationTarget({
    universeId,
    universeTitle: universePres?.title ?? null,
    mural: { master_id: mural.master_id, title: muralPres?.title ?? null },
    projectionId: projection?.projection_id ?? null,
    boundAssetId: binding?.asset_id ?? null,
  });
}

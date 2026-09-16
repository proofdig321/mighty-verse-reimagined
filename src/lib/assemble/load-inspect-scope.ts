import { getServiceClient } from "@/lib/authority/validate";
import {
  EMPTY_INSPECT_WORK_SCOPE,
  type InspectCanonicalScene,
  type InspectWorkScope,
  type InspectWorkSource,
} from "@/lib/media/inspect-scope";
import { loadUniverseAssembly } from "./load-universe";
import { suiteScenes } from "./suite";
import {
  associateAssetWithCanonicalWork,
  type CanonicalMasterRef,
} from "./studio";

/**
 * Resolve the Universe this asset belongs to, then load only that work's Scenes.
 * Unbound media and unknown assets return an empty Scene list — never a global dump.
 */
export async function loadInspectWorkScope(assetId: string | null): Promise<InspectWorkScope> {
  if (!assetId) return EMPTY_INSPECT_WORK_SCOPE;

  const svc = getServiceClient();

  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("asset_id, projection_id")
    .eq("asset_id", assetId);

  const projIds = [...new Set((bindings ?? []).map((binding) => binding.projection_id))];
  const { data: projections } = projIds.length
    ? await svc.from("projection").select("projection_id, master_id").in("projection_id", projIds)
    : { data: [] };

  const boundMasterIds = [...new Set((projections ?? []).map((projection) => projection.master_id))];
  const { data: boundMasters } = boundMasterIds.length
    ? await svc
        .from("master")
        .select("master_id, canonical_type, parent_master_id")
        .in("master_id", boundMasterIds)
    : { data: [] };

  const parentIds = [
    ...new Set((boundMasters ?? []).map((master) => master.parent_master_id).filter(Boolean) as string[]),
  ];
  const { data: parentMasters } = parentIds.length
    ? await svc
        .from("master")
        .select("master_id, canonical_type, parent_master_id")
        .in("master_id", parentIds)
    : { data: [] };

  const grandparentIds = [
    ...new Set((parentMasters ?? []).map((master) => master.parent_master_id).filter(Boolean) as string[]),
  ];
  const { data: grandparentMasters } = grandparentIds.length
    ? await svc
        .from("master")
        .select("master_id, canonical_type, parent_master_id")
        .in("master_id", grandparentIds)
    : { data: [] };

  const allMasters = [...(boundMasters ?? []), ...(parentMasters ?? []), ...(grandparentMasters ?? [])];
  const uniqueMasters = [...new Map(allMasters.map((master) => [master.master_id, master])).values()] as CanonicalMasterRef[];
  const titleIds = uniqueMasters.map((master) => master.master_id);
  const { data: presentations } = titleIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", titleIds)
    : { data: [] };

  const association = associateAssetWithCanonicalWork({
    assetId,
    bindings: bindings ?? [],
    projections: projections ?? [],
    masters: uniqueMasters,
    presentations: presentations ?? [],
  });

  let universeId = association.universe_id;
  let universeTitle = association.universe_title;
  let muralId = association.mural_id;
  let muralTitle = association.mural_title;
  let bound = association.bound_as !== null;
  let source: InspectWorkSource = bound ? "binding" : "unbound";

  if (!universeId) {
    const { data: session } = await svc
      .from("media_upload_session")
      .select("master_id")
      .eq("asset_id", assetId)
      .not("master_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session?.master_id) {
      const walked = await walkToUniverse(session.master_id);
      if (walked.universe_id) {
        universeId = walked.universe_id;
        universeTitle = walked.universe_title;
        muralId = muralId ?? walked.mural_id;
        muralTitle = muralTitle ?? walked.mural_title;
        source = "upload-session";
      }
    }
  }

  if (!universeId) {
    return {
      ...EMPTY_INSPECT_WORK_SCOPE,
      source: "unbound",
    };
  }

  const assembly = await loadUniverseAssembly(universeId);
  if (assembly) {
    universeTitle = assembly.title ?? universeTitle;
    const mural = assembly.murals[0] ?? null;
    if (mural) {
      muralId = muralId ?? mural.master_id;
      muralTitle = muralTitle ?? mural.title;
    }
  }

  const scenes: InspectCanonicalScene[] = assembly
    ? suiteScenes(assembly).map((scene) => ({
        master_id: scene.master_id,
        title: scene.title,
        start_ms: scene.start_ms,
        end_ms: scene.end_ms,
        universe_id: universeId,
      }))
    : [];

  return {
    universe_id: universeId,
    universe_title: universeTitle,
    mural_id: muralId,
    mural_title: muralTitle,
    bound,
    source,
    scenes,
  };
}

async function walkToUniverse(masterId: string): Promise<{
  universe_id: string | null;
  universe_title: string | null;
  mural_id: string | null;
  mural_title: string | null;
}> {
  const empty = {
    universe_id: null as string | null,
    universe_title: null as string | null,
    mural_id: null as string | null,
    mural_title: null as string | null,
  };

  const svc = getServiceClient();
  const chain: CanonicalMasterRef[] = [];
  let currentId: string | null = masterId;

  for (let i = 0; i < 4 && currentId; i++) {
    const { data } = await svc
      .from("master")
      .select("master_id, canonical_type, parent_master_id")
      .eq("master_id", currentId)
      .maybeSingle();
    const row = data as CanonicalMasterRef | null;
    if (!row) break;
    chain.push(row);
    currentId = row.parent_master_id;
  }

  const universe = chain.find((master) => master.canonical_type === "universe") ?? null;
  const mural = chain.find((master) => master.canonical_type === "mural") ?? null;
  if (!universe) return empty;

  const titleIds = [universe.master_id, mural?.master_id].filter(Boolean) as string[];
  const { data: presentations } = await svc
    .from("work_presentation")
    .select("master_id, title")
    .in("master_id", titleIds);

  return {
    universe_id: universe.master_id,
    universe_title: (presentations ?? []).find((row) => row.master_id === universe.master_id)?.title ?? null,
    mural_id: mural?.master_id ?? null,
    mural_title: mural
      ? (presentations ?? []).find((row) => row.master_id === mural.master_id)?.title ?? null
      : null,
  };
}

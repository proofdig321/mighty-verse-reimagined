import { getServiceClient } from "@/lib/authority/validate";
import { classifyProcessingPhase } from "@/lib/media/processing-state";
import { deriveCurateHub, type CurateHubSnapshot } from "./curate-hub";
import { loadUniverseAssembly } from "./load-universe";
import { suiteScenes } from "./suite";

export async function loadCurateHub(universeId: string): Promise<CurateHubSnapshot | null> {
  const assembly = await loadUniverseAssembly(universeId);
  if (!assembly) return null;

  const svc = getServiceClient();
  const { data: sessions } = await svc
    .from("media_upload_session")
    .select("session_id, phase, asset_id, updated_at")
    .eq("master_id", universeId)
    .order("updated_at", { ascending: false })
    .limit(10);

  const sceneAssetIds = suiteScenes(assembly)
    .map((scene) => scene.asset_id)
    .filter((id): id is string => Boolean(id));
  const sessionAssetIds = (sessions ?? [])
    .map((session) => session.asset_id)
    .filter((id): id is string => Boolean(id));
  const candidateAssets = [...new Set([...sceneAssetIds, ...sessionAssetIds])];

  const { data: inspections } = candidateAssets.length
    ? await svc.from("inspection_session").select("session_id").in("asset_id", candidateAssets)
    : { data: [] };

  const bound =
    assembly.murals.some((mural) => mural.has_media) || sceneAssetIds.length > 0;
  const latest = sessions?.[0] ?? null;
  const incomingAssetId =
    !bound && classifyProcessingPhase(latest?.phase) === "ingested" && latest?.asset_id
      ? latest.asset_id
      : null;

  return deriveCurateHub({
    assembly,
    sessions: sessions ?? [],
    inspectCount: inspections?.length ?? 0,
    incomingAssetId,
    boundAssetId: sceneAssetIds[0] ?? incomingAssetId,
  });
}

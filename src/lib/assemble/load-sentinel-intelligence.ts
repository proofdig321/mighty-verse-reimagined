import { getInspectionSession, listInspectionSessions } from "../media/sentinel";
import {
  composeSentinelIntelligence,
  type SentinelIntelligence,
} from "../media/sentinel-intelligence";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";

export async function loadSentinelIntelligence(
  assembly: UniverseAssembly,
  options?: { includeObservations?: boolean },
): Promise<SentinelIntelligence | null> {
  const scenes = suiteScenes(assembly);
  const mural = assembly.murals[0] ?? null;
  if (!scenes.length && !mural) return null;

  const assetId = scenes.find((scene) => scene.asset_id)?.asset_id ?? null;
  const includeObservations = options?.includeObservations !== false;
  let sessionId: string | null = null;
  let observations: {
    time_ms: number;
    mean_luminance: number | null;
    change_score: number | null;
    is_boundary_candidate: boolean;
  }[] = [];

  if (includeObservations && assetId) {
    const sessions = await listInspectionSessions(assetId);
    const latest = sessions.find((session) => session.status === "completed") ?? sessions[0] ?? null;
    const detailed = latest ? await getInspectionSession(latest.session_id) : null;
    sessionId = detailed?.session.session_id ?? latest?.session_id ?? null;
    observations = detailed?.observations ?? [];
  }

  return composeSentinelIntelligence({
    session_id: sessionId,
    asset_id: assetId,
    observations,
    scenes: scenes.map((scene) => ({
      master_id: scene.master_id,
      title: scene.title,
      binding_id: scene.binding_id,
      start_ms: scene.start_ms,
      end_ms: scene.end_ms,
      sort_order: scene.sort_order,
      provider: scene.provider,
      storage_ref: scene.storage_ref,
      asset_id: scene.asset_id,
      creative_moments: scene.creative_moments,
    })),
    moments: assembly.creative_moments.map((moment) => ({
      master_id: moment.master_id,
      title: moment.title,
      scene_ids: moment.scene_ids,
    })),
    mural: mural
      ? {
          master_id: mural.master_id,
          title: mural.title,
          provider: mural.provider,
          storage_ref: mural.storage_ref,
        }
      : null,
  });
}

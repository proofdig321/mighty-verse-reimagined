import { getServiceClient } from "../authority/validate";
import { getProvider } from "../media/providers";
import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";

export type SuiteSourceWindow = {
  scene_master_id: string;
  title: string | null;
  start_ms: number;
  end_ms: number;
};

export type SuiteSourcePreview = {
  asset_id: string;
  title: string | null;
  provider: string;
  playback_id: string;
  endpoint_ref: string;
  duration_ms: number | null;
  mural_id: string;
  mural_title: string | null;
  mural_projection_id: string;
  mural_canonical_state_id: string | null;
  windows: SuiteSourceWindow[];
};

/**
 * Resolve the Universe's bound source media for Studio preview.
 * Read-only. Does not rebind, realize, or change Scene windows.
 */
export async function loadSuiteSourcePreview(
  assembly: UniverseAssembly,
): Promise<SuiteSourcePreview | null> {
  const mural = assembly.murals[0] ?? null;
  const scenes = suiteScenes(assembly);
  const assetId = scenes.find((scene) => scene.asset_id)?.asset_id ?? null;
  if (!mural || !assetId) return null;

  const svc = getServiceClient();
  const [{ data: muralMaster }, { data: muralProjection }, { data: asset }] = await Promise.all([
    svc.from("master").select("master_id, current_state_id").eq("master_id", mural.master_id).maybeSingle(),
    svc
      .from("projection")
      .select("projection_id, master_id")
      .eq("master_id", mural.master_id)
      .eq("projection_type", "experiential")
      .maybeSingle(),
    svc
      .from("media_asset")
      .select("asset_id, provider, storage_ref, duration_ms, intake_id")
      .eq("asset_id", assetId)
      .maybeSingle(),
  ]);

  if (!asset?.provider || !asset.storage_ref || asset.storage_ref.startsWith("seed:placeholder:")) {
    return null;
  }

  const [{ data: variants }, { data: intake }] = await Promise.all([
    svc.from("delivery_variant").select("endpoint_ref").eq("asset_id", assetId).limit(1),
    asset.intake_id
      ? svc.from("media_intake").select("title").eq("intake_id", asset.intake_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const variant = variants?.[0] ?? null;

  let endpoint = variant?.endpoint_ref ?? null;
  let playbackId = asset.storage_ref;
  try {
    const source = getProvider(asset.provider).buildPlaybackSource(
      asset.storage_ref,
      asset.provider === "mux" ? "video" : "video",
    );
    playbackId = source.playbackId;
    endpoint = endpoint ?? source.endpoint;
  } catch {
    return null;
  }
  if (!endpoint) return null;

  const windows = scenes
    .filter((scene) => scene.start_ms != null && scene.end_ms != null && scene.end_ms > scene.start_ms)
    .map((scene) => ({
      scene_master_id: scene.master_id,
      title: scene.title,
      start_ms: scene.start_ms as number,
      end_ms: scene.end_ms as number,
    }));

  return {
    asset_id: asset.asset_id,
    title: intake?.title ?? mural.title,
    provider: asset.provider,
    playback_id: playbackId,
    endpoint_ref: endpoint,
    duration_ms: asset.duration_ms,
    mural_id: mural.master_id,
    mural_title: mural.title,
    mural_projection_id: muralProjection?.projection_id ?? mural.master_id,
    mural_canonical_state_id: muralMaster?.current_state_id ?? null,
    windows,
  };
}

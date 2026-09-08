import type {
  UniverseAssembly,
  UniverseAssemblyMural,
  UniverseAssemblyMoment,
  UniverseAssemblyRows,
  UniverseAssemblyScene,
} from "./types";

function assetFor(
  rows: UniverseAssemblyRows,
  projectionId: string | null | undefined,
): { provider: string | null; storage_ref: string | null } {
  if (!projectionId) return { provider: null, storage_ref: null };
  const binding = rows.bindings.find((row) => row.projection_id === projectionId);
  const asset = binding?.asset_id
    ? (rows.assets ?? []).find((row) => row.asset_id === binding.asset_id)
    : undefined;
  const storage = asset?.storage_ref ?? null;
  if (!storage || storage.startsWith("seed:placeholder:")) {
    return { provider: null, storage_ref: null };
  }
  return { provider: asset?.provider ?? null, storage_ref: storage };
}

/**
 * Compose a Universe assembly from already-loaded canonical rows.
 * Shared Powerhouse/Hand-to-Hand → Proverb relations are preserved as live data.
 */
export function buildUniverseAssembly(rows: UniverseAssemblyRows): UniverseAssembly {
  const titleFor = (id: string) => rows.presentations.find((row) => row.master_id === id)?.title ?? null;

  const primaryMomentByScene = new Map<string, string>();
  for (const relation of rows.relations) {
    if (!primaryMomentByScene.has(relation.scene_master_id)) {
      primaryMomentByScene.set(relation.scene_master_id, relation.moment_master_id);
    }
  }

  const scenesByMural = new Map<string, UniverseAssemblyScene[]>();
  for (const scene of rows.sceneMasters) {
    const muralId = scene.parent_master_id;
    if (!muralId) continue;
    const projection = rows.sceneProjections.find((row) => row.master_id === scene.master_id);
    const binding = projection
      ? rows.bindings.find((row) => row.projection_id === projection.projection_id)
      : null;
    const media = assetFor(rows, projection?.projection_id);
    const creativeMomentId = primaryMomentByScene.get(scene.master_id) ?? null;
    const entry: UniverseAssemblyScene = {
      master_id: scene.master_id,
      title: titleFor(scene.master_id),
      sort_order: scene.sort_order ?? null,
      start_ms: binding?.start_ms ?? null,
      end_ms: binding?.end_ms ?? null,
      projection_id: projection?.projection_id ?? null,
      creative_moment_id: creativeMomentId,
      creative_moment_title: creativeMomentId ? titleFor(creativeMomentId) : null,
      provider: media.provider,
      storage_ref: media.storage_ref,
    };
    const list = scenesByMural.get(muralId) ?? [];
    list.push(entry);
    scenesByMural.set(muralId, list);
  }

  const murals: UniverseAssemblyMural[] = rows.muralMasters.map((mural) => {
    const scenes = scenesByMural.get(mural.master_id) ?? [];
    const muralProjection = (rows.muralProjections ?? []).find((row) => row.master_id === mural.master_id);
    const muralMedia = assetFor(rows, muralProjection?.projection_id);
    const sceneMedia = scenes.find((scene) => scene.storage_ref) ?? null;
    const provider = muralMedia.provider ?? sceneMedia?.provider ?? null;
    const storage_ref = muralMedia.storage_ref ?? sceneMedia?.storage_ref ?? null;
    return {
      master_id: mural.master_id,
      title: titleFor(mural.master_id),
      scenes,
      has_media: Boolean(storage_ref),
      provider,
      storage_ref,
    };
  });

  const creative_moments: UniverseAssemblyMoment[] = rows.momentMasters.map((moment) => {
    const relatedScenes = rows.sceneMasters.filter(
      (scene) => primaryMomentByScene.get(scene.master_id) === moment.master_id,
    );
    return {
      master_id: moment.master_id,
      title: titleFor(moment.master_id),
      has_experience: rows.momentProjections.some((row) => row.master_id === moment.master_id),
      scene_ids: relatedScenes.map((scene) => scene.master_id),
      scene_titles: relatedScenes.map((scene) => titleFor(scene.master_id) ?? "Untitled scene"),
    };
  });

  return {
    master_id: rows.master.master_id,
    title: rows.presentation?.title ?? null,
    description: rows.presentation?.description ?? null,
    created_at: rows.master.created_at,
    murals,
    creative_moments,
  };
}

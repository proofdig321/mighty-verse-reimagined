import type {
  UniverseAssembly,
  UniverseAssemblyMural,
  UniverseAssemblyMoment,
  UniverseAssemblyRows,
  UniverseAssemblyScene,
} from "./types";

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
    };
    const list = scenesByMural.get(muralId) ?? [];
    list.push(entry);
    scenesByMural.set(muralId, list);
  }

  const murals: UniverseAssemblyMural[] = rows.muralMasters.map((mural) => ({
    master_id: mural.master_id,
    title: titleFor(mural.master_id),
    scenes: scenesByMural.get(mural.master_id) ?? [],
  }));

  const creative_moments: UniverseAssemblyMoment[] = rows.momentMasters.map((moment) => ({
    master_id: moment.master_id,
    title: titleFor(moment.master_id),
    has_experience: rows.momentProjections.some((row) => row.master_id === moment.master_id),
    scene_titles: rows.sceneMasters
      .filter((scene) => primaryMomentByScene.get(scene.master_id) === moment.master_id)
      .map((scene) => titleFor(scene.master_id) ?? "Untitled scene"),
  }));

  return {
    master_id: rows.master.master_id,
    title: rows.presentation?.title ?? null,
    description: rows.presentation?.description ?? null,
    created_at: rows.master.created_at,
    murals,
    creative_moments,
  };
}

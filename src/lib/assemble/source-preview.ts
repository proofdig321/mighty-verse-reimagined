import { suiteScenes } from "./suite";
import type { UniverseAssembly } from "./types";

/**
 * Bound source is the Mural's playable media. Scene windows may share that
 * asset, but a Mural with no Scenes still has a cinema clock.
 */
export function resolveSuiteSourceAssetId(assembly: UniverseAssembly): string | null {
  const mural = assembly.murals[0] ?? null;
  if (mural?.asset_id) return mural.asset_id;
  return suiteScenes(assembly).find((scene) => scene.asset_id)?.asset_id ?? null;
}

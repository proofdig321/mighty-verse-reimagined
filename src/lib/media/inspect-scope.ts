/**
 * Inspect nearest-Scene matching is scoped to one work.
 *
 * MEDIA ≠ CREATIVE WORK. AI PROPOSAL ≠ CANONICAL TRUTH.
 * A candidate beat on Father Raymond must not match Super Hero Ego Scenes
 * just because the clocks happen to be close.
 */

export const INSPECT_NEAREST_SCENE_MS = 10_000;
export const CURATE_NEAREST_SCENE_MS = 15_000;

export type InspectCanonicalScene = {
  master_id: string;
  title: string | null;
  start_ms: number | null;
  end_ms: number | null;
  universe_id?: string | null;
};

export type InspectWorkSource = "binding" | "upload-session" | "unbound" | "none";

export type InspectWorkScope = {
  universe_id: string | null;
  universe_title: string | null;
  mural_id: string | null;
  mural_title: string | null;
  bound: boolean;
  source: InspectWorkSource;
  scenes: InspectCanonicalScene[];
};

export const EMPTY_INSPECT_WORK_SCOPE: InspectWorkScope = {
  universe_id: null,
  universe_title: null,
  mural_id: null,
  mural_title: null,
  bound: false,
  source: "none",
  scenes: [],
};

export function selectScenesForWork(input: {
  scenes: InspectCanonicalScene[];
  universeId: string | null;
}): InspectCanonicalScene[] {
  if (!input.universeId) return [];
  return input.scenes.filter((scene) => scene.universe_id === input.universeId);
}

/**
 * Nearest canonical Scene on the already-scoped list.
 * Callers must pass only this work's Scenes. An empty list never matches.
 */
export function nearestCanonicalScene(
  scenes: InspectCanonicalScene[],
  startMs: number,
  thresholdMs: number = INSPECT_NEAREST_SCENE_MS,
): { scene: InspectCanonicalScene; deltaMs: number } | null {
  let best: InspectCanonicalScene | null = null;
  let bestDiff = Infinity;
  for (const scene of scenes) {
    if (scene.start_ms == null) continue;
    const diff = Math.abs(scene.start_ms - startMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = scene;
    }
  }
  if (!best || bestDiff > thresholdMs) return null;
  return { scene: best, deltaMs: bestDiff };
}

export function inspectWorkBelongingCopy(scope: {
  universe_id: string | null;
  universe_title: string | null;
  source: InspectWorkSource;
}): string {
  const title = scope.universe_title?.trim();
  if (title) {
    if (scope.source === "upload-session") {
      return `This media belongs to ${title}. It is not bound to a Mural yet. Candidate beats are evidence only — they are not Scenes from another Universe.`;
    }
    return `This media belongs to ${title}. Canonical Scenes listed here are only those already established on this Universe.`;
  }
  return "This media is not attached to a Universe. Timing matches to another work — including Super Hero Ego — are not shown.";
}

export function inspectEmptyScenesCopy(scope: {
  universe_id: string | null;
  universe_title: string | null;
  sceneCount: number;
}): string | null {
  if (scope.sceneCount > 0) return null;
  const title = scope.universe_title?.trim();
  if (title) {
    return `${title} has no canonical Scenes yet. Candidate timings are not compared to Scenes from another Universe.`;
  }
  return "No canonical Scenes belong to this media. Super Hero Ego Scenes are a different work.";
}

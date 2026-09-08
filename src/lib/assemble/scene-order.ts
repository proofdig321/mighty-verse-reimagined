/**
 * Creative Suite — author canonical Scene order.
 *
 * Order lives on master.sort_order for mural-child Scenes.
 * Do not import Scene Deck shuffle. Shuffle stays presentation-only.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSceneOrderId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type SceneOrderMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type SceneOrderDecisionOk = {
  ok: true;
  action: "update_order";
  universe_id: string;
  mural_id: string;
  orders: { master_id: string; sort_order: number }[];
  imports_shuffle: false;
  touches_identity: false;
  touches_timing: false;
  creates_scene: false;
};

export type SceneOrderRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_mural"
  | "wrong_universe"
  | "not_scene"
  | "order_mismatch"
  | "duplicate_id";

export type SceneOrderDecisionErr = {
  ok: false;
  code: SceneOrderRejectCode;
  message: string;
};

export type SceneOrderDecision = SceneOrderDecisionOk | SceneOrderDecisionErr;

function reject(code: SceneOrderRejectCode, message: string): SceneOrderDecisionErr {
  return { ok: false, code, message };
}

export function proposeMovedSceneOrder(
  orderedSceneIds: string[],
  sceneId: string,
  direction: "earlier" | "later",
): string[] | null {
  const index = orderedSceneIds.indexOf(sceneId);
  if (index < 0) return null;
  const swap = direction === "earlier" ? index - 1 : index + 1;
  if (swap < 0 || swap >= orderedSceneIds.length) return null;
  const next = [...orderedSceneIds];
  [next[index], next[swap]] = [next[swap], next[index]];
  return next;
}

export function decideSceneOrder(input: {
  universe_id?: string | null;
  mural_id?: string | null;
  ordered_scene_ids?: string[] | null;
  scenes: SceneOrderMaster[];
  mural: SceneOrderMaster | null;
}): SceneOrderDecision {
  if (!input.mural) {
    return reject("not_found", "Mural was not found.");
  }
  if (input.mural.canonical_type !== "mural") {
    return reject("not_mural", "Scene order can only be authored on a Mural's Scenes.");
  }
  const muralId = input.mural_id?.trim() || input.mural.master_id;
  if (!isSceneOrderId(muralId) || muralId !== input.mural.master_id) {
    return reject("invalid_id", "Mural must be a canonical identifier.");
  }

  const universeId = input.mural.parent_master_id;
  if (!universeId) {
    return reject("wrong_universe", "The Mural must belong to a Universe.");
  }
  const requestedUniverse = input.universe_id?.trim();
  if (requestedUniverse && requestedUniverse !== universeId) {
    return reject("wrong_universe", "Scene order can only be authored inside this Universe.");
  }

  const orderedIds = (input.ordered_scene_ids ?? []).map((id) => id.trim());
  if (!orderedIds.length) {
    return reject("missing_ids", "Scene order requires the Scenes of this Mural.");
  }
  if (orderedIds.some((id) => !isSceneOrderId(id))) {
    return reject("invalid_id", "Every Scene must be a canonical identifier.");
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return reject("duplicate_id", "Scene order cannot contain the same Scene twice.");
  }

  const scenes = input.scenes ?? [];
  if (scenes.length !== orderedIds.length) {
    return reject("order_mismatch", "Scene order must include every Scene of this Mural.");
  }

  const byId = new Map(scenes.map((scene) => [scene.master_id, scene]));
  for (const id of orderedIds) {
    const scene = byId.get(id);
    if (!scene) {
      return reject("order_mismatch", "Scene order must include every Scene of this Mural.");
    }
    if (scene.canonical_type !== "scene") {
      return reject("not_scene", "Canonical order can only be authored for Scenes.");
    }
    if (scene.parent_master_id !== muralId) {
      return reject("not_mural", "Every Scene in this order must belong to the same Mural.");
    }
  }
  if (scenes.some((scene) => !orderedIds.includes(scene.master_id))) {
    return reject("order_mismatch", "Scene order must include every Scene of this Mural.");
  }

  return {
    ok: true,
    action: "update_order",
    universe_id: universeId,
    mural_id: muralId,
    orders: orderedIds.map((master_id, index) => ({ master_id, sort_order: index + 1 })),
    imports_shuffle: false,
    touches_identity: false,
    touches_timing: false,
    creates_scene: false,
  };
}

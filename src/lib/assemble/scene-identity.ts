/**
 * Creative Suite — author Scene identity (title + description).
 *
 * Identity lives on work_presentation. Timing, order, presence, projections,
 * and media are out of scope. Does not create Scenes.
 */

import { validateUniverseIdentity, type UniverseIdentity } from "./identity";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSceneIdentityId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type SceneIdentityMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type SceneIdentityDecisionOk = {
  ok: true;
  action: "update_identity";
  universe_id: string;
  scene_master_id: string;
  identity: UniverseIdentity;
  touches_timing: false;
  touches_order: false;
  creates_scene: false;
  creates_projection: false;
  creates_media: false;
};

export type SceneIdentityRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_scene"
  | "not_mural"
  | "wrong_universe"
  | "invalid_identity";

export type SceneIdentityDecisionErr = {
  ok: false;
  code: SceneIdentityRejectCode;
  message: string;
};

export type SceneIdentityDecision = SceneIdentityDecisionOk | SceneIdentityDecisionErr;

function reject(code: SceneIdentityRejectCode, message: string): SceneIdentityDecisionErr {
  return { ok: false, code, message };
}

export function decideSceneIdentity(input: {
  universe_id?: string | null;
  scene_master_id?: string | null;
  title?: unknown;
  description?: unknown;
  scene: SceneIdentityMaster | null;
  mural: SceneIdentityMaster | null;
}): SceneIdentityDecision {
  const sceneId = input.scene_master_id?.trim() || input.scene?.master_id?.trim() || "";
  if (!sceneId) {
    return reject("missing_ids", "A Scene is required.");
  }
  if (!isSceneIdentityId(sceneId)) {
    return reject("invalid_id", "Scene must be a canonical identifier.");
  }
  if (!input.scene || !input.mural) {
    return reject("not_found", "Scene was not found.");
  }
  if (input.scene.canonical_type !== "scene") {
    return reject("not_scene", "Identity can only be authored on a Scene.");
  }
  if (input.mural.canonical_type !== "mural" || input.scene.parent_master_id !== input.mural.master_id) {
    return reject("not_mural", "A Scene must belong to a Mural.");
  }

  const universeId = input.mural.parent_master_id;
  if (!universeId) {
    return reject("wrong_universe", "The Scene must belong to a Universe.");
  }
  const requestedUniverse = input.universe_id?.trim();
  if (requestedUniverse && requestedUniverse !== universeId) {
    return reject("wrong_universe", "Scene identity can only be authored inside this Universe.");
  }

  const identity = validateUniverseIdentity({ title: input.title, description: input.description });
  if (!identity.ok) {
    return reject("invalid_identity", identity.error);
  }

  return {
    ok: true,
    action: "update_identity",
    universe_id: universeId,
    scene_master_id: sceneId,
    identity: identity.value,
    touches_timing: false,
    touches_order: false,
    creates_scene: false,
    creates_projection: false,
    creates_media: false,
  };
}

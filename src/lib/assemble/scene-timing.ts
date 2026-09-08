/**
 * Creative Suite — shape an existing Scene window.
 *
 * Timing lives on projection_media_binding (start_ms / end_ms).
 * Does not create Scenes, projections, or media. Sentinel still creates Scenes.
 */

import { parseTimelineMs } from "../media/timing";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSceneTimingId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type SceneTimingMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type SceneTimingBinding = {
  binding_id: string;
  projection_id: string;
  master_id: string;
};

export type SceneTimingDecisionOk = {
  ok: true;
  action: "update_timing";
  universe_id: string;
  scene_master_id: string;
  binding_id: string;
  start_ms: number;
  end_ms: number;
  creates_scene: false;
  creates_projection: false;
  creates_media: false;
  touches_identity: false;
  touches_order: false;
};

export type SceneTimingRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_scene"
  | "not_mural"
  | "wrong_universe"
  | "missing_binding"
  | "binding_mismatch"
  | "invalid_timing"
  | "invalid_range";

export type SceneTimingDecisionErr = {
  ok: false;
  code: SceneTimingRejectCode;
  message: string;
};

export type SceneTimingDecision = SceneTimingDecisionOk | SceneTimingDecisionErr;

function reject(code: SceneTimingRejectCode, message: string): SceneTimingDecisionErr {
  return { ok: false, code, message };
}

export function decideSceneTiming(input: {
  universe_id?: string | null;
  scene_master_id?: string | null;
  binding_id?: string | null;
  start_ms?: unknown;
  end_ms?: unknown;
  scene: SceneTimingMaster | null;
  mural: SceneTimingMaster | null;
  binding: SceneTimingBinding | null;
}): SceneTimingDecision {
  const sceneId = input.scene_master_id?.trim() || input.scene?.master_id?.trim() || "";
  const bindingId = input.binding_id?.trim() || input.binding?.binding_id?.trim() || "";
  if (!sceneId) {
    return reject("missing_ids", "A Scene is required.");
  }
  if (!isSceneTimingId(sceneId)) {
    return reject("invalid_id", "Scene must be a canonical identifier.");
  }
  if (!input.scene || !input.mural) {
    return reject("not_found", "Scene was not found.");
  }
  if (input.scene.canonical_type !== "scene") {
    return reject("not_scene", "Timing can only be authored on a Scene.");
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
    return reject("wrong_universe", "Scene timing can only be authored inside this Universe.");
  }

  if (!bindingId || !isSceneTimingId(bindingId)) {
    return reject("missing_binding", "This Scene has no media window to shape.");
  }
  if (!input.binding) {
    return reject("missing_binding", "This Scene has no media window to shape.");
  }
  if (input.binding.binding_id !== bindingId || input.binding.master_id !== sceneId) {
    return reject("binding_mismatch", "Timing can only be authored on this Scene's own window.");
  }

  const startMs = parseTimelineMs(typeof input.start_ms === "number" || typeof input.start_ms === "string" ? input.start_ms : null);
  const endMs = parseTimelineMs(typeof input.end_ms === "number" || typeof input.end_ms === "string" ? input.end_ms : null);
  if (startMs == null || endMs == null) {
    return reject("invalid_timing", "Start and end must be milliseconds, 0:36, or 0:36.000.");
  }
  if (endMs <= startMs) {
    return reject("invalid_range", "End must be after start.");
  }

  return {
    ok: true,
    action: "update_timing",
    universe_id: universeId,
    scene_master_id: sceneId,
    binding_id: bindingId,
    start_ms: startMs,
    end_ms: endMs,
    creates_scene: false,
    creates_projection: false,
    creates_media: false,
    touches_identity: false,
    touches_order: false,
  };
}

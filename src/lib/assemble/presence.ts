/**
 * Creative Suite — author Scene ↔ Creative Moment presence.
 *
 * The relationship is scene_moment. Creative Moments stay Universe-parented.
 * Scenes stay Mural children. Relating does not create objects, projections,
 * media bindings, or playback.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPresenceId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type PresenceMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type PresenceDecisionOk = {
  ok: true;
  action: "relate" | "already_related" | "unrelate";
  universe_id: string;
  scene_master_id: string;
  moment_master_id: string;
  creates_projection: false;
  creates_media: false;
  deletes_objects: false;
};

export type PresenceRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_scene"
  | "not_mural"
  | "not_creative_moment"
  | "wrong_universe"
  | "missing_relation";

export type PresenceDecisionErr = {
  ok: false;
  code: PresenceRejectCode;
  message: string;
};

export type PresenceDecision = PresenceDecisionOk | PresenceDecisionErr;

export type PresenceOption = {
  master_id: string;
  title: string | null;
};

function reject(code: PresenceRejectCode, message: string): PresenceDecisionErr {
  return { ok: false, code, message };
}

function resolveUniverse(input: {
  scene_master_id?: string | null;
  moment_master_id?: string | null;
  scene: PresenceMaster | null;
  mural: PresenceMaster | null;
  moment: PresenceMaster | null;
  universe_id?: string | null;
}): PresenceDecisionErr | { universe_id: string; scene_master_id: string; moment_master_id: string } {
  const sceneId = input.scene_master_id?.trim() || input.scene?.master_id?.trim() || "";
  const momentId = input.moment_master_id?.trim() || input.moment?.master_id?.trim() || "";
  if (!sceneId || !momentId) {
    return reject("missing_ids", "A Scene and a Creative Moment are required.");
  }
  if (!isPresenceId(sceneId) || !isPresenceId(momentId)) {
    return reject("invalid_id", "Scene and Creative Moment must be canonical identifiers.");
  }
  if (!input.scene || !input.mural || !input.moment) {
    return reject("not_found", "Scene or Creative Moment was not found.");
  }
  if (input.scene.canonical_type !== "scene") {
    return reject("not_scene", "Presence can only be authored on a Scene.");
  }
  if (input.mural.canonical_type !== "mural" || input.scene.parent_master_id !== input.mural.master_id) {
    return reject("not_mural", "A Scene must belong to a Mural.");
  }
  if (input.moment.canonical_type !== "creative-moment") {
    return reject("not_creative_moment", "Presence can only relate a Creative Moment.");
  }

  const sceneUniverseId = input.mural.parent_master_id;
  const momentUniverseId = input.moment.parent_master_id;
  if (!sceneUniverseId || !momentUniverseId || sceneUniverseId !== momentUniverseId) {
    return reject("wrong_universe", "The Scene and Creative Moment must belong to the same Universe.");
  }
  const requestedUniverse = input.universe_id?.trim();
  if (requestedUniverse && requestedUniverse !== sceneUniverseId) {
    return reject("wrong_universe", "Presence can only be authored inside this Universe.");
  }

  return {
    universe_id: sceneUniverseId,
    scene_master_id: sceneId,
    moment_master_id: momentId,
  };
}

function accepted(
  action: PresenceDecisionOk["action"],
  resolved: { universe_id: string; scene_master_id: string; moment_master_id: string },
): PresenceDecisionOk {
  return {
    ok: true,
    action,
    ...resolved,
    creates_projection: false,
    creates_media: false,
    deletes_objects: false,
  };
}

export function decideAddPresence(input: {
  scene_master_id?: string | null;
  moment_master_id?: string | null;
  scene: PresenceMaster | null;
  mural: PresenceMaster | null;
  moment: PresenceMaster | null;
  universe_id?: string | null;
  alreadyRelated: boolean;
}): PresenceDecision {
  const resolved = resolveUniverse(input);
  if ("code" in resolved) return resolved;
  if (input.alreadyRelated) return accepted("already_related", resolved);
  return accepted("relate", resolved);
}

export function decideRemovePresence(input: {
  scene_master_id?: string | null;
  moment_master_id?: string | null;
  scene: PresenceMaster | null;
  mural: PresenceMaster | null;
  moment: PresenceMaster | null;
  universe_id?: string | null;
  alreadyRelated: boolean;
}): PresenceDecision {
  const resolved = resolveUniverse(input);
  if ("code" in resolved) return resolved;
  if (!input.alreadyRelated) {
    return reject("missing_relation", "That presence is not currently related.");
  }
  return accepted("unrelate", resolved);
}

export function availablePresenceOptions(
  options: PresenceOption[],
  relatedIds: string[],
): PresenceOption[] {
  const related = new Set(relatedIds);
  return options.filter((option) => !related.has(option.master_id));
}

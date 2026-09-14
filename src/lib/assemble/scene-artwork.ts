/**
 * Creative Suite — Scene still / thumbnail.
 *
 * Artwork lives on work_presentation.artwork_asset_id via POST /api/authority/media/artwork.
 * Does not create Scenes, projections, or media windows. Sentinel does not create Scenes.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSceneArtworkId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export type SceneArtworkMaster = {
  master_id: string;
  canonical_type: string;
  parent_master_id: string | null;
};

export type SceneArtworkDecisionOk = {
  ok: true;
  action: "set_artwork";
  universe_id: string;
  scene_master_id: string;
  thumbnail_url: string;
  creates_scene: false;
  creates_projection: false;
  creates_media_window: false;
};

export type SceneArtworkRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "not_found"
  | "not_scene"
  | "not_mural"
  | "wrong_universe"
  | "invalid_url";

export type SceneArtworkDecisionErr = {
  ok: false;
  code: SceneArtworkRejectCode;
  message: string;
};

export type SceneArtworkDecision = SceneArtworkDecisionOk | SceneArtworkDecisionErr;

function reject(code: SceneArtworkRejectCode, message: string): SceneArtworkDecisionErr {
  return { ok: false, code, message };
}

export function decideSceneArtwork(input: {
  universe_id?: string | null;
  scene_master_id?: string | null;
  thumbnail_url?: string | null;
  scene: SceneArtworkMaster | null;
  mural: SceneArtworkMaster | null;
}): SceneArtworkDecision {
  const sceneId = input.scene_master_id?.trim() || input.scene?.master_id?.trim() || "";
  if (!sceneId) return reject("missing_ids", "A Scene is required.");
  if (!isSceneArtworkId(sceneId)) return reject("invalid_id", "Scene must be a canonical identifier.");
  if (!input.scene || !input.mural) return reject("not_found", "Scene was not found.");
  if (input.scene.canonical_type !== "scene") {
    return reject("not_scene", "A still can only be authored on a Scene.");
  }
  if (input.mural.canonical_type !== "mural" || input.scene.parent_master_id !== input.mural.master_id) {
    return reject("not_mural", "A Scene must belong to a Mural.");
  }
  const universeId = input.mural.parent_master_id;
  if (!universeId) return reject("wrong_universe", "The Scene must belong to a Universe.");
  const requestedUniverse = input.universe_id?.trim();
  if (requestedUniverse && requestedUniverse !== universeId) {
    return reject("wrong_universe", "Scene stills can only be authored inside this Universe.");
  }

  const raw = input.thumbnail_url?.trim() ?? "";
  if (!raw) return reject("invalid_url", "A still URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return reject("invalid_url", "Still must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    return reject("invalid_url", "Still must use HTTPS.");
  }

  return {
    ok: true,
    action: "set_artwork",
    universe_id: universeId,
    scene_master_id: sceneId,
    thumbnail_url: parsed.toString(),
    creates_scene: false,
    creates_projection: false,
    creates_media_window: false,
  };
}

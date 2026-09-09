/**
 * Retain a Sentinel observation or storyboard still as a curated production reference.
 *
 * Promote means curate for production — not canonicalise.
 * Does not create Universe, Mural, Scene, Creative Moment, projection, binding, or realization.
 */

import {
  CURATED_REFERENCE_PROVIDER,
  curatedReferenceIntegrityHash,
  isReferenceRole,
  type ReferenceRole,
} from "./lifecycle";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function optionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export type RetainReferenceDecisionOk = {
  ok: true;
  action: "retain_reference";
  universe_id: string;
  source_asset_id: string;
  time_ms: number;
  role: ReferenceRole;
  scene_master_id: string | null;
  moment_master_id: string | null;
  panel_id: string | null;
  session_id: string | null;
  integrity_hash: string;
  provider: typeof CURATED_REFERENCE_PROVIDER;
  creates_universe: false;
  creates_mural: false;
  creates_scene: false;
  creates_creative_moment: false;
  creates_projection: false;
  creates_binding: false;
  creates_realization: false;
  binds_projection: false;
  canonicalises: false;
};

export type RetainReferenceRejectCode =
  | "missing_ids"
  | "invalid_id"
  | "invalid_time"
  | "invalid_role";

export type RetainReferenceDecisionErr = {
  ok: false;
  code: RetainReferenceRejectCode;
  message: string;
};

export type RetainReferenceDecision = RetainReferenceDecisionOk | RetainReferenceDecisionErr;

export type CuratedReferenceProvenance = {
  kind: "curated-reference";
  universe_id: string;
  source_asset_id: string;
  time_ms: number;
  role: ReferenceRole;
  scene_master_id: string | null;
  moment_master_id: string | null;
  panel_id: string | null;
  session_id: string | null;
};

export function parseReferenceProvenance(value: string | null | undefined): CuratedReferenceProvenance | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CuratedReferenceProvenance>;
    if (parsed.kind !== "curated-reference") return null;
    if (!isId(parsed.universe_id) || !isId(parsed.source_asset_id)) return null;
    if (typeof parsed.time_ms !== "number" || !isReferenceRole(parsed.role)) return null;
    return {
      kind: "curated-reference",
      universe_id: parsed.universe_id,
      source_asset_id: parsed.source_asset_id,
      time_ms: parsed.time_ms,
      role: parsed.role,
      scene_master_id: isId(parsed.scene_master_id) ? parsed.scene_master_id : null,
      moment_master_id: isId(parsed.moment_master_id) ? parsed.moment_master_id : null,
      panel_id: typeof parsed.panel_id === "string" ? parsed.panel_id : null,
      session_id: isId(parsed.session_id) ? parsed.session_id : null,
    };
  } catch {
    return null;
  }
}

export function decideRetainReference(input: {
  universe_id?: unknown;
  source_asset_id?: unknown;
  time_ms?: unknown;
  role?: unknown;
  scene_master_id?: unknown;
  moment_master_id?: unknown;
  panel_id?: unknown;
  session_id?: unknown;
}): RetainReferenceDecision {
  const universeId = optionalId(input.universe_id);
  const sourceAssetId = optionalId(input.source_asset_id);
  if (!universeId || !sourceAssetId) {
    return { ok: false, code: "missing_ids", message: "A Universe and source media asset are required." };
  }
  if (!isId(universeId) || !isId(sourceAssetId)) {
    return { ok: false, code: "invalid_id", message: "Universe and source media must be canonical identifiers." };
  }

  const sceneId = optionalId(input.scene_master_id);
  const momentId = optionalId(input.moment_master_id);
  const sessionId = optionalId(input.session_id);
  if (sceneId && !isId(sceneId)) {
    return { ok: false, code: "invalid_id", message: "Scene must be a canonical identifier." };
  }
  if (momentId && !isId(momentId)) {
    return { ok: false, code: "invalid_id", message: "Creative Moment must be a canonical identifier." };
  }
  if (sessionId && !isId(sessionId)) {
    return { ok: false, code: "invalid_id", message: "Inspection session must be a canonical identifier." };
  }

  const timeMs = typeof input.time_ms === "number" ? input.time_ms : Number(input.time_ms);
  if (!Number.isInteger(timeMs) || timeMs < 0) {
    return { ok: false, code: "invalid_time", message: "A non-negative frame time is required." };
  }

  const roleRaw = typeof input.role === "string" && input.role.trim() ? input.role.trim() : "still";
  if (!isReferenceRole(roleRaw)) {
    return { ok: false, code: "invalid_role", message: "Reference role must be a production reference role." };
  }

  const panelId = typeof input.panel_id === "string" && input.panel_id.trim() ? input.panel_id.trim() : null;

  return {
    ok: true,
    action: "retain_reference",
    universe_id: universeId,
    source_asset_id: sourceAssetId,
    time_ms: timeMs,
    role: roleRaw,
    scene_master_id: sceneId,
    moment_master_id: momentId,
    panel_id: panelId,
    session_id: sessionId,
    integrity_hash: curatedReferenceIntegrityHash({
      universe_id: universeId,
      source_asset_id: sourceAssetId,
      time_ms: timeMs,
      role: roleRaw,
    }),
    provider: CURATED_REFERENCE_PROVIDER,
    creates_universe: false,
    creates_mural: false,
    creates_scene: false,
    creates_creative_moment: false,
    creates_projection: false,
    creates_binding: false,
    creates_realization: false,
    binds_projection: false,
    canonicalises: false,
  };
}

export function referenceProvenanceNotes(decision: RetainReferenceDecisionOk): string {
  const provenance: CuratedReferenceProvenance = {
    kind: "curated-reference",
    universe_id: decision.universe_id,
    source_asset_id: decision.source_asset_id,
    time_ms: decision.time_ms,
    role: decision.role,
    scene_master_id: decision.scene_master_id,
    moment_master_id: decision.moment_master_id,
    panel_id: decision.panel_id,
    session_id: decision.session_id,
  };
  return JSON.stringify(provenance);
}

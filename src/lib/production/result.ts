/**
 * Production result registration, approval, and Scene-layer attachment.
 *
 * Mux delivers the video. Mighty Verse decides what the video means.
 * Registration does not create canonical objects or bind the canonical Mux source.
 */

import { productionResultIntegrityHash, VIDEO_INFRASTRUCTURE } from "./lifecycle";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function optionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && UUID_RE.test(trimmed) ? trimmed : null;
}

function optionalToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : null;
}

export type ProductionApproval = "awaiting" | "approved" | "rejected";

export type ProductionResultProvenance = {
  kind: "production-result";
  universe_id: string;
  scene_master_id: string;
  mux_asset_id: string;
  playback_id: string;
  video_infrastructure: typeof VIDEO_INFRASTRUCTURE;
  executor: string | null;
  executor_job_id: string | null;
  approval: ProductionApproval;
  attached: boolean;
  source_asset_id: string | null;
  canonical_start_ms: number | null;
  canonical_end_ms: number | null;
};

export type RegisterProductionDecisionOk = {
  ok: true;
  action: "register_production_result";
  universe_id: string;
  scene_master_id: string;
  mux_asset_id: string;
  playback_id: string;
  integrity_hash: string;
  executor: string | null;
  executor_job_id: string | null;
  source_asset_id: string | null;
  canonical_start_ms: number | null;
  canonical_end_ms: number | null;
  creates_universe: false;
  creates_mural: false;
  creates_scene: false;
  creates_creative_moment: false;
  creates_projection: false;
  creates_binding: false;
  creates_realization: false;
  binds_projection: false;
  canonicalises: false;
  replaces_canonical_mux: false;
};

export type RegisterProductionDecisionErr = {
  ok: false;
  code: "missing_ids" | "invalid_id" | "missing_playback" | "canonical_source";
  message: string;
};

export type RegisterProductionDecision = RegisterProductionDecisionOk | RegisterProductionDecisionErr;

export type ApproveProductionDecision =
  | {
      ok: true;
      action: "approve_production_result";
      asset_id: string;
      attach: boolean;
      creates_canonical: false;
      binds_canonical_mux: false;
      populates_media_realization: false;
    }
  | {
      ok: false;
      code: "missing_ids" | "invalid_id" | "not_production" | "not_approved";
      message: string;
    };

export function parseProductionProvenance(value: string | null | undefined): ProductionResultProvenance | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ProductionResultProvenance>;
    if (parsed.kind !== "production-result") return null;
    if (!isId(parsed.universe_id) || !isId(parsed.scene_master_id)) return null;
    if (typeof parsed.mux_asset_id !== "string" || !parsed.mux_asset_id.trim()) return null;
    if (typeof parsed.playback_id !== "string" || !parsed.playback_id.trim()) return null;
    const approval: ProductionApproval =
      parsed.approval === "approved" || parsed.approval === "rejected" ? parsed.approval : "awaiting";
    return {
      kind: "production-result",
      universe_id: parsed.universe_id,
      scene_master_id: parsed.scene_master_id,
      mux_asset_id: parsed.mux_asset_id.trim(),
      playback_id: parsed.playback_id.trim(),
      video_infrastructure: VIDEO_INFRASTRUCTURE,
      executor: typeof parsed.executor === "string" ? parsed.executor : null,
      executor_job_id: typeof parsed.executor_job_id === "string" ? parsed.executor_job_id : null,
      approval,
      attached: parsed.attached === true,
      source_asset_id: isId(parsed.source_asset_id) ? parsed.source_asset_id : null,
      canonical_start_ms: typeof parsed.canonical_start_ms === "number" ? parsed.canonical_start_ms : null,
      canonical_end_ms: typeof parsed.canonical_end_ms === "number" ? parsed.canonical_end_ms : null,
    };
  } catch {
    return null;
  }
}

export function productionProvenanceNotes(
  decision: RegisterProductionDecisionOk,
  approval: ProductionApproval = "awaiting",
  attached = false,
): string {
  const provenance: ProductionResultProvenance = {
    kind: "production-result",
    universe_id: decision.universe_id,
    scene_master_id: decision.scene_master_id,
    mux_asset_id: decision.mux_asset_id,
    playback_id: decision.playback_id,
    video_infrastructure: VIDEO_INFRASTRUCTURE,
    executor: decision.executor,
    executor_job_id: decision.executor_job_id,
    approval,
    attached,
    source_asset_id: decision.source_asset_id,
    canonical_start_ms: decision.canonical_start_ms,
    canonical_end_ms: decision.canonical_end_ms,
  };
  return JSON.stringify(provenance);
}

export function decideRegisterProductionResult(input: {
  universe_id?: unknown;
  scene_master_id?: unknown;
  mux_asset_id?: unknown;
  playback_id?: unknown;
  executor?: unknown;
  executor_job_id?: unknown;
  source_asset_id?: unknown;
  canonical_start_ms?: unknown;
  canonical_end_ms?: unknown;
  blocked_mux_asset_ids?: string[] | null;
  blocked_playback_ids?: string[] | null;
}): RegisterProductionDecision {
  const universeId = optionalId(input.universe_id);
  const sceneId = optionalId(input.scene_master_id);
  const muxAssetId = optionalToken(input.mux_asset_id);
  const playbackId = optionalToken(input.playback_id) ?? "";
  if (!universeId || !sceneId || !muxAssetId) {
    return { ok: false, code: "missing_ids", message: "Universe, Scene, and Mux asset are required." };
  }
  const sourceAssetId = optionalId(input.source_asset_id);
  if (sourceAssetId && !isId(sourceAssetId)) {
    return { ok: false, code: "invalid_id", message: "Source media must be a canonical identifier." };
  }
  if (!playbackId) {
    return { ok: false, code: "missing_playback", message: "Mux playback is not ready. Mighty Verse will not invent a playback ID." };
  }

  const blockedMux = new Set((input.blocked_mux_asset_ids ?? []).filter(Boolean));
  const blockedPlayback = new Set((input.blocked_playback_ids ?? []).filter(Boolean));
  if (blockedMux.has(muxAssetId) || blockedPlayback.has(playbackId)) {
    return {
      ok: false,
      code: "canonical_source",
      message: "Canonical Mux source media cannot be registered as a production result.",
    };
  }

  const startMs = typeof input.canonical_start_ms === "number" ? input.canonical_start_ms : null;
  const endMs = typeof input.canonical_end_ms === "number" ? input.canonical_end_ms : null;

  return {
    ok: true,
    action: "register_production_result",
    universe_id: universeId,
    scene_master_id: sceneId,
    mux_asset_id: muxAssetId,
    playback_id: playbackId,
    integrity_hash: productionResultIntegrityHash({
      universe_id: universeId,
      scene_master_id: sceneId,
      mux_asset_id: muxAssetId,
    }),
    executor: typeof input.executor === "string" && input.executor.trim() ? input.executor.trim() : null,
    executor_job_id: typeof input.executor_job_id === "string" && input.executor_job_id.trim() ? input.executor_job_id.trim() : null,
    source_asset_id: sourceAssetId,
    canonical_start_ms: startMs,
    canonical_end_ms: endMs,
    creates_universe: false,
    creates_mural: false,
    creates_scene: false,
    creates_creative_moment: false,
    creates_projection: false,
    creates_binding: false,
    creates_realization: false,
    binds_projection: false,
    canonicalises: false,
    replaces_canonical_mux: false,
  };
}

export function decideApproveProductionResult(input: {
  asset_id?: unknown;
  provenance?: ProductionResultProvenance | null;
  attach?: unknown;
}): ApproveProductionDecision {
  const assetId = optionalId(input.asset_id);
  if (!assetId) {
    return { ok: false, code: "missing_ids", message: "A production media asset is required." };
  }
  if (!isId(assetId)) {
    return { ok: false, code: "invalid_id", message: "Production media must be a canonical identifier." };
  }
  if (!input.provenance) {
    return { ok: false, code: "not_production", message: "This asset is not a production result." };
  }
  return {
    ok: true,
    action: "approve_production_result",
    asset_id: assetId,
    attach: input.attach === true,
    creates_canonical: false,
    binds_canonical_mux: false,
    populates_media_realization: false,
  };
}

export function decideAttachProductionLayer(input: {
  provenance?: ProductionResultProvenance | null;
}): { ok: true; attached: true } | { ok: false; code: "not_approved" | "not_production"; message: string } {
  if (!input.provenance) {
    return { ok: false, code: "not_production", message: "This asset is not a production result." };
  }
  if (input.provenance.approval !== "approved") {
    return { ok: false, code: "not_approved", message: "Only approved production results may enter Experience." };
  }
  return { ok: true, attached: true };
}

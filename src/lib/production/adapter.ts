/**
 * Provider-agnostic production adapter contract.
 *
 * Mighty Verse owns canonical context, the production plan, authority, provenance,
 * result registration, and publication.
 *
 * An external creative executor owns generation/rendering.
 * Mux is the Mighty Verse video ingest/playback/delivery infrastructure.
 * Mux is not the AI generation engine.
 *
 * The default adapter remains disconnected. Stage 4.6 may opt into a replaceable
 * proof executor without making that executor the product AI provider.
 */

import type { SceneProductionBrief } from "./plan";
import { VIDEO_INFRASTRUCTURE } from "./lifecycle";

export function productionPlanId(universeId: string, sceneMasterId: string): string {
  return `production-plan:${universeId}:${sceneMasterId}`;
}
export const PRODUCTION_VIDEO_INFRASTRUCTURE = VIDEO_INFRASTRUCTURE;
export const PRODUCTION_ADAPTER_CONNECTED = false;
export const PRODUCTION_PROOF_SCENE_MASTER_ID = "4790c7cf-bb19-4a01-a243-e5c3eb680555";

export function isFfmpegProofExecutor(value: string | null | undefined): boolean {
  return value === "ffmpeg" || value === "ffmpeg-proof";
}

export type ProductionProviderKind = "image" | "video" | "dcc" | "render" | "compositor" | "ffmpeg";

export type ProductionJobRequest = {
  universe_id: string;
  scene_master_id: string;
  brief: SceneProductionBrief;
  provider_kind?: ProductionProviderKind;
  provider?: string;
};

export type ProductionJobResult = {
  provider: string;
  provider_job_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "not_connected";
  output_asset_id: string | null;
  creates_canonical: false;
  populates_media_realization: false;
};

export type ProductionDispatchDecision =
  | {
      ok: false;
      code: "not_connected" | "missing_plan" | "proof_locked";
      message: string;
      creates_canonical: false;
      populates_media_realization: false;
    }
  | {
      ok: true;
      action: "dispatch_production";
      request: ProductionJobRequest;
      executor: string;
    };

export function decideProductionDispatch(input: {
  universe_id?: string | null;
  brief?: SceneProductionBrief | null;
  proof?: boolean;
  proof_executor?: string | null;
}): ProductionDispatchDecision {
  if (!input.brief || !input.universe_id) {
    return {
      ok: false,
      code: "missing_plan",
      message: "A Scene production brief is required before dispatch.",
      creates_canonical: false,
      populates_media_realization: false,
    };
  }
  const proofExecutor = input.proof === true ? (input.proof_executor ?? "").trim() : "";
  if (input.proof === true && (proofExecutor === "ffmpeg" || proofExecutor === "ffmpeg-proof")) {
    if (input.brief.scene_master_id !== PRODUCTION_PROOF_SCENE_MASTER_ID) {
      return {
        ok: false,
        code: "proof_locked",
        message: "Stage 4.6 proof execution is locked to Powerhouse only.",
        creates_canonical: false,
        populates_media_realization: false,
      };
    }
    return {
      ok: true,
      action: "dispatch_production",
      executor: "ffmpeg-proof",
      request: {
        universe_id: input.universe_id,
        scene_master_id: input.brief.scene_master_id,
        brief: input.brief,
        provider_kind: "ffmpeg",
        provider: "ffmpeg-proof",
      },
    };
  }
  return {
    ok: false,
    code: "not_connected",
    message: "No creative production executor is connected. Mux remains the video infrastructure and will ingest a result when an executor returns one.",
    creates_canonical: false,
    populates_media_realization: false,
  };
}

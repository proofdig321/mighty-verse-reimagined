/**
 * Provider-agnostic production adapter contract.
 *
 * Mighty Verse owns canonical context, the production plan, authority, provenance,
 * result registration, and publication.
 *
 * An external provider owns execution, generation, rendering, and tool operations.
 * No provider is connected in this increment. Do not fake job completion.
 */

import type { SceneProductionBrief } from "./plan";

export const PRODUCTION_ADAPTER_CONNECTED = false;

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
      code: "not_connected" | "missing_plan";
      message: string;
      creates_canonical: false;
      populates_media_realization: false;
    }
  | {
      ok: true;
      action: "dispatch_production";
      request: ProductionJobRequest;
    };

export function decideProductionDispatch(input: {
  universe_id?: string | null;
  brief?: SceneProductionBrief | null;
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
  return {
    ok: false,
    code: "not_connected",
    message: "No production provider is connected. Mighty Verse records plans; external tools execute later.",
    creates_canonical: false,
    populates_media_realization: false,
  };
}

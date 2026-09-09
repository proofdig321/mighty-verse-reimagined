/**
 * Persist a Mux-ready production result as media_asset + intake provenance.
 * Does not bind projections, create Scenes, or populate media_realization.
 */

import { muxAdapter } from "@/lib/media/providers/mux/adapter";
import { formatTimelineMs } from "@/lib/media/timing";
import type { RegisterProductionDecisionOk } from "./result";
import { productionProvenanceNotes } from "./result";

type ServiceClient = ReturnType<typeof import("@/lib/authority/validate").getServiceClient>;

export async function persistProductionMuxAsset(input: {
  svc: ServiceClient;
  decision: RegisterProductionDecisionOk;
  participantId: string;
  sceneTitle: string | null;
  durationMs: number | null;
  resolution: string | null;
  mediaClass: "audio" | "video" | "image" | "other";
  format: string | null;
}): Promise<{ asset_id: string; created: boolean }> {
  const svc = input.svc;

  const { data: existingHash } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("integrity_hash", input.decision.integrity_hash)
    .maybeSingle();
  if (existingHash) return { asset_id: existingHash.asset_id, created: false };

  const { data: existingMux } = await svc
    .from("media_asset")
    .select("asset_id, integrity_hash")
    .eq("provider", "mux")
    .eq("provider_asset_id", input.decision.mux_asset_id)
    .maybeSingle();
  if (existingMux?.integrity_hash?.startsWith("production:")) {
    return { asset_id: existingMux.asset_id, created: false };
  }
  if (existingMux) {
    throw new Error("canonical_source");
  }

  const playback = muxAdapter.buildPlaybackSource(
    input.decision.playback_id,
    input.mediaClass === "audio" ? "audio" : "video",
  );

  const { data: asset, error: assetError } = await svc
    .from("media_asset")
    .insert({
      asset_type: "original",
      storage_ref: input.decision.playback_id,
      integrity_hash: input.decision.integrity_hash,
      format: input.format,
      resolution: input.resolution,
      duration_ms: input.durationMs,
      media_class: input.mediaClass,
      provider: "mux",
      provider_asset_id: input.decision.mux_asset_id,
    })
    .select("asset_id")
    .single();

  if (assetError || !asset) {
    if (assetError?.code === "23505") {
      const { data: raced } = await svc
        .from("media_asset")
        .select("asset_id")
        .eq("integrity_hash", input.decision.integrity_hash)
        .maybeSingle();
      if (raced) return { asset_id: raced.asset_id, created: false };
    }
    throw new Error(assetError?.message ?? "Failed to register production media.");
  }

  const windowLabel =
    input.decision.canonical_start_ms != null && input.decision.canonical_end_ms != null
      ? `${formatTimelineMs(input.decision.canonical_start_ms)} → ${formatTimelineMs(input.decision.canonical_end_ms)}`
      : "Scene";

  const { data: intake, error: intakeError } = await svc
    .from("media_intake")
    .insert({
      master_id: input.decision.universe_id,
      asset_id: asset.asset_id,
      title: `${input.sceneTitle ?? "Scene"} production · ${windowLabel}`,
      work_type: "video",
      source_type: "other",
      source_provider: "mux",
      external_identifier: input.decision.mux_asset_id,
      supplied_by: input.participantId,
      isrc_status: "not-applicable",
      provenance_notes: productionProvenanceNotes(input.decision),
    })
    .select("intake_id")
    .single();

  if (intakeError || !intake) {
    throw new Error(intakeError?.message ?? "Failed to record production provenance.");
  }

  await svc.from("media_asset").update({ intake_id: intake.intake_id }).eq("asset_id", asset.asset_id);
  await svc.from("delivery_variant").insert({
    asset_id: asset.asset_id,
    delivery_format: "hls",
    endpoint_ref: playback.endpoint,
  });

  return { asset_id: asset.asset_id, created: true };
}

/** Mux source assets (integrity_hash mux:*) must never be re-registered as production results. */
export async function loadCanonicalMuxBlocklist(svc: ServiceClient): Promise<{
  muxAssetIds: string[];
  playbackIds: string[];
}> {
  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, provider_asset_id, storage_ref, integrity_hash")
    .eq("provider", "mux");

  const muxAssetIds = new Set<string>();
  const playbackIds = new Set<string>();
  for (const asset of assets ?? []) {
    if (typeof asset.integrity_hash !== "string" || !asset.integrity_hash.startsWith("mux:")) continue;
    if (asset.provider_asset_id) muxAssetIds.add(asset.provider_asset_id);
    if (asset.asset_id) muxAssetIds.add(asset.asset_id);
    if (asset.storage_ref) playbackIds.add(asset.storage_ref);
  }
  return { muxAssetIds: [...muxAssetIds], playbackIds: [...playbackIds] };
}

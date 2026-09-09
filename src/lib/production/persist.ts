/**
 * Persist a Mux-ready production result as media_asset + intake provenance
 * and a Scene-scoped media_realization. Does not bind canonical projections
 * or create Scenes.
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
}): Promise<{ asset_id: string; created: boolean; intake_id: string | null }> {
  const svc = input.svc;

  const { data: existingHash } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("integrity_hash", input.decision.integrity_hash)
    .maybeSingle();
  if (existingHash) {
    const { data: hashed } = await svc
      .from("media_asset")
      .select("asset_id, intake_id")
      .eq("asset_id", existingHash.asset_id)
      .maybeSingle();
    return { asset_id: existingHash.asset_id, created: false, intake_id: hashed?.intake_id ?? null };
  }

  const { data: existingMux } = await svc
    .from("media_asset")
    .select("asset_id, integrity_hash")
    .eq("provider", "mux")
    .eq("provider_asset_id", input.decision.mux_asset_id)
    .maybeSingle();
  if (existingMux?.integrity_hash?.startsWith("production:")) {
    const { data: existingIntake } = await svc
      .from("media_intake")
      .select("intake_id")
      .eq("asset_id", existingMux.asset_id)
      .maybeSingle();
    return { asset_id: existingMux.asset_id, created: false, intake_id: existingIntake?.intake_id ?? null };
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
      if (raced) {
        const { data: racedIntake } = await svc
          .from("media_intake")
          .select("intake_id")
          .eq("asset_id", raced.asset_id)
          .maybeSingle();
        return { asset_id: raced.asset_id, created: false, intake_id: racedIntake?.intake_id ?? null };
      }
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

  return { asset_id: asset.asset_id, created: true, intake_id: intake.intake_id };
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

export async function persistProductionRealization(input: {
  svc: ServiceClient;
  participantId: string;
  assetId: string;
  intakeId: string;
  decision: RegisterProductionDecisionOk;
  approval?: "awaiting" | "approved" | "rejected";
  attached?: boolean;
}): Promise<{ realization_id: string; created: boolean }> {
  const { data: asset } = await input.svc
    .from("media_asset")
    .select("asset_id, realization_id")
    .eq("asset_id", input.assetId)
    .maybeSingle();
  if (asset?.realization_id) {
    return { realization_id: asset.realization_id, created: false };
  }

  let intakeId = input.intakeId;
  if (!intakeId) {
    const { data: existingIntake } = await input.svc
      .from("media_intake")
      .select("intake_id")
      .eq("asset_id", input.assetId)
      .maybeSingle();
    intakeId = existingIntake?.intake_id ?? "";
  }

  const notes = JSON.stringify({
    kind: "production-realization",
    plan_id: input.decision.plan_id,
    universe_id: input.decision.universe_id,
    scene_master_id: input.decision.scene_master_id,
    mural_id: input.decision.mural_id,
    mux_asset_id: input.decision.mux_asset_id,
    playback_id: input.decision.playback_id,
    media_asset_id: input.assetId,
    executor: input.decision.executor,
    executor_job_id: input.decision.executor_job_id,
    video_infrastructure: "mux",
    approval: input.approval ?? "awaiting",
    attached: input.attached === true,
    creates_canonical: false,
    replaces_canonical_mux: false,
  });

  const { data: realization, error } = await input.svc
    .from("media_realization")
    .insert({
      master_id: input.decision.scene_master_id,
      realization_type: "visualisation",
      rights_basis: "experimental production proof — rights not conferred",
      production_notes: notes,
      created_by: input.participantId,
      version_label: "Powerhouse production proof",
      isrc_status: "not-applicable",
    })
    .select("realization_id")
    .single();

  if (error || !realization) {
    throw new Error(error?.message ?? "Failed to record production realization.");
  }

  await input.svc.from("media_asset").update({ realization_id: realization.realization_id }).eq("asset_id", input.assetId);
  await input.svc
    .from("media_intake")
    .update({
      provenance_notes: productionProvenanceNotes(
        { ...input.decision, realization_id: realization.realization_id },
        input.approval ?? "awaiting",
        input.attached === true,
      ),
    })
    .eq("intake_id", intakeId);

  return { realization_id: realization.realization_id, created: true };
}

export async function updateProductionRealizationNotes(input: {
  svc: ServiceClient;
  realizationId: string;
  approval: "awaiting" | "approved" | "rejected";
  attached: boolean;
}): Promise<void> {
  const { data: row } = await input.svc
    .from("media_realization")
    .select("production_notes")
    .eq("realization_id", input.realizationId)
    .maybeSingle();
  let notes: Record<string, unknown> = {};
  try {
    notes = row?.production_notes ? JSON.parse(row.production_notes) as Record<string, unknown> : {};
  } catch {
    notes = { kind: "production-realization" };
  }
  notes.approval = input.approval;
  notes.attached = input.attached;
  await input.svc
    .from("media_realization")
    .update({ production_notes: JSON.stringify(notes) })
    .eq("realization_id", input.realizationId);
}

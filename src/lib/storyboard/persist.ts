import { muxAdapter } from "../media/providers/mux/adapter";
import { muxThumbnailUrl } from "../media/thumbnail";
import { storyboardArtifactNotes, storyboardBodyNotes, type StoryboardOutputType } from "./artifact";

type ServiceClient = ReturnType<typeof import("../authority/validate").getServiceClient>;

export async function persistStoryboardBody(input: {
  svc: ServiceClient;
  universeId: string | null;
  participantId: string;
  body: string;
  panelCount: number;
}): Promise<{ intake_id: string }> {
  const notes = storyboardBodyNotes({
    universe_id: input.universeId ?? "",
    body: input.body,
    panel_count: input.panelCount,
  });
  let existingQuery = input.svc
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId);
  existingQuery = input.universeId
    ? existingQuery.eq("master_id", input.universeId)
    : existingQuery.is("master_id", null);

  const { data: existing } = await existingQuery;

  const current = (existing ?? []).find((row) => {
    try {
      return JSON.parse(row.provenance_notes ?? "{}")?.kind === "storyboard-body";
    } catch {
      return false;
    }
  });

  if (current) {
    await input.svc
      .from("media_intake")
      .update({ provenance_notes: notes, title: "Storyboard", updated_at: new Date().toISOString() })
      .eq("intake_id", current.intake_id);
    return { intake_id: current.intake_id };
  }

  const { data, error } = await input.svc
    .from("media_intake")
    .insert({
      master_id: input.universeId,
      title: "Storyboard",
      work_type: "other",
      source_type: "other",
      supplied_by: input.participantId,
      isrc_status: "not-applicable",
      provenance_notes: notes,
    })
    .select("intake_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save storyboard.");
  return { intake_id: data.intake_id };
}

export async function persistStoryboardArtifact(input: {
  svc: ServiceClient;
  universeId: string | null;
  participantId: string;
  outputType: StoryboardOutputType;
  panelId: string | null;
  title: string;
  description: string | null;
  source: "script" | "sentinel" | "reference" | "ai";
  muxAssetId: string;
  playbackId: string;
  durationMs: number | null;
  mediaClass: "audio" | "video" | "image" | "other";
  format: string | null;
  resolution: string | null;
}): Promise<{ asset_id: string; intake_id: string; still_url: string; endpoint_ref: string }> {
  const scope = input.universeId ?? "standalone";
  const playback = muxAdapter.buildPlaybackSource(input.playbackId, input.mediaClass === "image" ? "video" : input.mediaClass);
  const stillUrl = muxThumbnailUrl(input.playbackId, 0, 640);
  const { data: asset, error: assetError } = await input.svc
    .from("media_asset")
    .insert({
      asset_type: "preview",
      storage_ref: input.playbackId,
      integrity_hash: `storyboard:${scope}:${input.muxAssetId}`,
      format: input.format,
      resolution: input.resolution,
      duration_ms: input.durationMs,
      media_class: input.mediaClass,
      provider: "mux",
      provider_asset_id: input.muxAssetId,
    })
    .select("asset_id")
    .single();
  if (assetError || !asset) throw new Error(assetError?.message ?? "Failed to register storyboard media.");

  const { data: intake, error: intakeError } = await input.svc
    .from("media_intake")
    .insert({
      master_id: input.universeId,
      asset_id: asset.asset_id,
      title: input.title,
      work_type: input.outputType === "animation" || input.outputType === "gif" ? "animation" : "video",
      source_type: "other",
      source_provider: "mux",
      external_identifier: input.muxAssetId,
      supplied_by: input.participantId,
      isrc_status: "not-applicable",
      provenance_notes: storyboardArtifactNotes({
        universe_id: input.universeId ?? "",
        output_type: input.outputType,
        panel_id: input.panelId,
        title: input.title,
        description: input.description,
        source: input.source,
        mux_asset_id: input.muxAssetId,
        playback_id: input.playbackId,
        still_url: stillUrl,
      }),
    })
    .select("intake_id")
    .single();
  if (intakeError || !intake) throw new Error(intakeError?.message ?? "Failed to record storyboard artifact.");

  await input.svc.from("media_asset").update({ intake_id: intake.intake_id }).eq("asset_id", asset.asset_id);
  await input.svc.from("delivery_variant").insert({
    asset_id: asset.asset_id,
    delivery_format: "hls",
    endpoint_ref: playback.endpoint,
  });

  return { asset_id: asset.asset_id, intake_id: intake.intake_id, still_url: stillUrl, endpoint_ref: playback.endpoint };
}

export async function associateStoryboardWork(input: {
  svc: ServiceClient;
  participantId: string;
  universeId: string;
}): Promise<{ moved: number }> {
  const { data: rows } = await input.svc
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId)
    .is("master_id", null);

  let moved = 0;
  for (const row of rows ?? []) {
    let notes = row.provenance_notes;
    try {
      const parsed = JSON.parse(notes ?? "{}") as { kind?: string; universe_id?: string };
      if (parsed.kind === "storyboard-body" || parsed.kind === "storyboard-artifact") {
        parsed.universe_id = input.universeId;
        notes = JSON.stringify(parsed);
      }
    } catch {
      notes = row.provenance_notes;
    }
    const { error } = await input.svc
      .from("media_intake")
      .update({
        master_id: input.universeId,
        provenance_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq("intake_id", row.intake_id);
    if (!error) moved += 1;
  }
  return { moved };
}

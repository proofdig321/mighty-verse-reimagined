/**
 * Storyboard work/panel mutations. Never create canonical Scenes.
 */
import { getServiceClient } from "../authority/validate";
import { muxThumbnailUrl } from "../media/thumbnail";
import type { StoryboardPanelRecord, StoryboardWorkRecord, StoryboardWorkSummary } from "./document";
import { applyOrder, nextSequence } from "./mutations";
import {
  isStoryboardOwnedIntake,
  parseStoryboardAssembly,
  storyboardAssemblyNotes,
  storyboardFrameNotes,
  storyboardSourceNotes,
  type StoryboardAssemblyRecord,
} from "./source";
import {
  loadStoryboardWorkById,
  updateStoryboardPanel,
} from "./work";

type ServiceClient = ReturnType<typeof getServiceClient>;

function svc(client?: ServiceClient) {
  return client ?? getServiceClient();
}

export async function createStoryboardWork(input: {
  participantId: string;
  universeId?: string | null;
  title?: string;
  body?: string;
  premise?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const { data, error } = await db
    .from("storyboard_work")
    .insert({
      universe_id: input.universeId ?? null,
      participant_id: input.participantId,
      title: input.title ?? "Untitled storyboard",
      body: input.body ?? "",
      premise: input.premise ?? null,
      source: "script",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create storyboard work.");
  const work = await loadStoryboardWorkById({ workId: data.work_id, participantId: input.participantId, client: db });
  if (!work) throw new Error("Failed to load created storyboard work.");
  return work;
}

export async function listStoryboardWorks(input: {
  participantId: string;
  universeId?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkSummary[]> {
  const db = svc(input.client);
  let query = db
    .from("storyboard_work")
    .select("work_id, title, premise, updated_at, universe_id, status")
    .eq("participant_id", input.participantId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (input.universeId) query = query.eq("universe_id", input.universeId);
  const { data: works } = await query;
  if (!works?.length) return [];
  const ids = works.map((work) => work.work_id);
  const { data: panels } = await db.from("storyboard_panel").select("work_id, active_still_asset_id, active_motion_asset_id").in("work_id", ids);
  const { data: jobs } = await db
    .from("generation_job")
    .select("work_id, status")
    .eq("participant_id", input.participantId)
    .in("work_id", ids)
    .order("created_at", { ascending: false });
  const counts = new Map<string, { panels: number; still: boolean; motion: boolean }>();
  for (const panel of panels ?? []) {
    const current = counts.get(panel.work_id) ?? { panels: 0, still: false, motion: false };
    current.panels += 1;
    if (panel.active_still_asset_id) current.still = true;
    if (panel.active_motion_asset_id) current.motion = true;
    counts.set(panel.work_id, current);
  }
  const jobStatus = new Map<string, StoryboardWorkSummary["generation_status"]>();
  for (const job of jobs ?? []) {
    if (!job.work_id || jobStatus.has(job.work_id)) continue;
    if (job.status === "queued" || job.status === "submitted" || job.status === "processing") jobStatus.set(job.work_id, "generating");
    else if (job.status === "failed" || job.status === "unavailable" || job.status === "blocked") jobStatus.set(job.work_id, "failed");
    else if (job.status === "completed") jobStatus.set(job.work_id, "ready");
    else jobStatus.set(job.work_id, "idle");
  }
  return works.map((work) => {
    const stats = counts.get(work.work_id) ?? { panels: 0, still: false, motion: false };
    return {
      work_id: work.work_id,
      title: work.title,
      premise: work.premise,
      updated_at: work.updated_at,
      panel_count: stats.panels,
      universe_id: work.universe_id,
      attached: Boolean(work.universe_id),
      status: work.status,
      generation_status: jobStatus.get(work.work_id) ?? "idle",
      selected_still: stats.still,
      selected_motion: stats.motion,
      creates_scene: false as const,
    };
  });
}

export async function duplicateStoryboardWork(input: {
  workId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const current = await loadStoryboardWorkById(input);
  if (!current) throw new Error("Storyboard was not found.");
  const copy = await createStoryboardWork({
    participantId: input.participantId,
    universeId: current.universe_id,
    title: `${current.title} copy`,
    body: current.body,
    premise: current.premise,
    client: input.client,
  });
  if (current.panels.length) {
    const db = svc(input.client);
    const rows = current.panels.map((panel) => ({
      work_id: copy.work_id,
      sequence: panel.sequence,
      title: panel.title,
      description: panel.description,
      narrative_purpose: panel.narrative_purpose,
      action: panel.action,
      dialogue: panel.dialogue,
      narration: panel.narration,
      camera: panel.camera,
      camera_movement: panel.camera_movement,
      framing: panel.framing,
      lens_style: panel.lens_style,
      lighting: panel.lighting,
      environment: panel.environment,
      characters: panel.characters,
      mood: panel.mood,
      transition: panel.transition,
      duration_ms: panel.duration_ms,
      aspect_ratio: panel.aspect_ratio,
      status: "draft",
      source: panel.source,
      panel_references: panel.references,
      user_locked: false,
      generation_metadata: panel.generation_metadata ?? {},
    }));
    const { error } = await db.from("storyboard_panel").insert(rows);
    if (error) throw new Error(error.message);
  }
  return (await loadStoryboardWorkById({ workId: copy.work_id, participantId: input.participantId, client: input.client })) as StoryboardWorkRecord;
}

export async function archiveStoryboardWork(input: {
  workId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<boolean> {
  const db = svc(input.client);
  const { data } = await db
    .from("storyboard_work")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("work_id", input.workId)
    .eq("participant_id", input.participantId)
    .select("work_id")
    .maybeSingle();
  return Boolean(data);
}

export type DeletedStoryboardWork = {
  deleted: true;
  work_id: string;
  universe_id: string | null;
  intake_removed: number;
  creates_scene: false;
  creates_canonical: false;
  mutates_canonical: false;
};

/**
 * Delete a Storyboard workspace. Panels and generation jobs cascade from
 * `storyboard_work`. Work-owned media_intake provenance is removed by work_id.
 * Canonical Universe / Mural / Scene / Creative Moment / Experience records
 * are never deleted or mutated.
 */
export async function deleteStoryboardWork(input: {
  workId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<DeletedStoryboardWork | null> {
  const db = svc(input.client);
  const work = await loadStoryboardWorkById(input);
  if (!work) return null;

  const { data: intakes } = await db
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId)
    .ilike("provenance_notes", `%${input.workId}%`);
  const ownedIds = (intakes ?? [])
    .filter((row) => isStoryboardOwnedIntake(row.provenance_notes, input.workId))
    .map((row) => row.intake_id);
  if (ownedIds.length) {
    const { error } = await db.from("media_intake").delete().in("intake_id", ownedIds);
    if (error) throw new Error(error.message);
  }

  const { data: removed, error } = await db
    .from("storyboard_work")
    .delete()
    .eq("work_id", input.workId)
    .eq("participant_id", input.participantId)
    .select("work_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!removed) return null;

  return {
    deleted: true,
    work_id: input.workId,
    universe_id: work.universe_id,
    intake_removed: ownedIds.length,
    creates_scene: false,
    creates_canonical: false,
    mutates_canonical: false,
  };
}

export async function attachStoryboardWorkToUniverse(input: {
  workId: string;
  participantId: string;
  universeId: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const current = await loadStoryboardWorkById(input);
  if (!current) throw new Error("Storyboard was not found.");
  await db
    .from("storyboard_work")
    .update({ universe_id: input.universeId, updated_at: new Date().toISOString() })
    .eq("work_id", input.workId)
    .eq("participant_id", input.participantId);
  return (await loadStoryboardWorkById({ ...input, client: db })) as StoryboardWorkRecord;
}

export async function createStoryboardPanel(input: {
  workId: string;
  participantId: string;
  title?: string;
  description?: string;
  stillUrl?: string | null;
  assetId?: string | null;
  timeMs?: number | null;
  sentinelPanelId?: string | null;
  sceneMasterId?: string | null;
  durationMs?: number | null;
  source?: "script" | "sentinel" | "ai" | "hybrid";
  sourceTitle?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const current = await loadStoryboardWorkById(input);
  if (!current) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  const sequence = nextSequence(current.panels);
  const { error } = await db.from("storyboard_panel").insert({
    work_id: input.workId,
    sequence,
    title: input.title ?? `Panel ${sequence}`,
    description: input.description ?? "",
    status: "draft",
    source: input.source ?? "script",
    sentinel_panel_id: input.sentinelPanelId ?? null,
    proposed_scene_id: input.sceneMasterId ?? null,
    duration_ms: input.durationMs ?? null,
    active_still_asset_id: input.assetId ?? null,
    panel_references: input.stillUrl
      ? [
          {
            role: "still",
            label: input.title ?? `Panel ${sequence}`,
            url: input.stillUrl,
            asset_id: input.assetId ?? null,
            preferred: true,
            time_ms: input.timeMs ?? null,
            source_title: input.sourceTitle ?? "Sentinel still",
          },
        ]
      : [],
  });
  if (error) throw new Error(error.message);
  await db.from("storyboard_work").update({ updated_at: new Date().toISOString() }).eq("work_id", input.workId);
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function useStillOnStoryboard(input: {
  workId: string;
  participantId: string;
  panelId?: string | null;
  assetId?: string | null;
  stillUrl: string;
  title?: string;
  timeMs?: number | null;
  sentinelPanelId?: string | null;
  sceneMasterId?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const current = input.panelId
    ? await loadStoryboardWorkById(input)
    : await createStoryboardPanel({
        ...input,
        source: "sentinel",
        sourceTitle: "Curated reference",
      });
  if (!current) throw new Error("Storyboard was not found.");
  const targetId = input.panelId ?? current.panels[current.panels.length - 1]?.panel_id;
  if (!targetId) throw new Error("Storyboard panel was not found.");
  const panel = current.panels.find((item) => item.panel_id === targetId);
  const next = await updateStoryboardPanel({
    participantId: input.participantId,
    panelId: targetId,
    patch: {
      active_still_asset_id: input.assetId ?? panel?.active_still_asset_id ?? null,
      sentinel_panel_id: input.sentinelPanelId ?? panel?.sentinel_panel_id ?? null,
      proposed_scene_id: input.sceneMasterId ?? panel?.proposed_scene_id ?? null,
      references: [
        {
          role: "still",
          label: input.title ?? panel?.title ?? "Still",
          url: input.stillUrl,
          asset_id: input.assetId ?? null,
          preferred: true,
          time_ms: input.timeMs ?? null,
          source_title: "Sentinel still",
        },
        ...(panel?.references.filter((item) => item.url !== input.stillUrl) ?? []),
      ],
    },
    client: input.client,
  });
  if (!next) throw new Error("Still could not be attached to the panel.");
  return (await loadStoryboardWorkById({
    workId: input.workId,
    participantId: input.participantId,
    client: input.client,
  })) as StoryboardWorkRecord;
}

export async function duplicateStoryboardPanel(input: {
  panelId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const { data: panel } = await db.from("storyboard_panel").select("*").eq("panel_id", input.panelId).maybeSingle();
  if (!panel) throw new Error("Panel was not found.");
  const work = await loadStoryboardWorkById({ workId: String(panel.work_id), participantId: input.participantId, client: db });
  if (!work) throw new Error("Storyboard was not found.");
  const sequence = nextSequence(work.panels);
  const { error } = await db.from("storyboard_panel").insert({
    work_id: panel.work_id,
    sequence,
    title: `${panel.title} copy`,
    description: panel.description,
    narrative_purpose: panel.narrative_purpose,
    action: panel.action,
    dialogue: panel.dialogue,
    narration: panel.narration,
    camera: panel.camera,
    camera_movement: panel.camera_movement,
    framing: panel.framing,
    lens_style: panel.lens_style,
    lighting: panel.lighting,
    environment: panel.environment,
    characters: panel.characters,
    mood: panel.mood,
    transition: panel.transition,
    duration_ms: panel.duration_ms,
    aspect_ratio: panel.aspect_ratio,
    status: "draft",
    source: panel.source,
    panel_references: panel.panel_references,
    user_locked: false,
    generation_metadata: panel.generation_metadata ?? {},
  });
  if (error) throw new Error(error.message);
  return (await loadStoryboardWorkById({ workId: String(panel.work_id), participantId: input.participantId, client: db })) as StoryboardWorkRecord;
}

export async function deleteStoryboardPanel(input: {
  panelId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const { data: panel } = await db.from("storyboard_panel").select("work_id").eq("panel_id", input.panelId).maybeSingle();
  if (!panel) throw new Error("Panel was not found.");
  const owned = await loadStoryboardWorkById({ workId: String(panel.work_id), participantId: input.participantId, client: db });
  if (!owned) throw new Error("Storyboard was not found.");
  await db.from("storyboard_panel").delete().eq("panel_id", input.panelId);
  const work = await loadStoryboardWorkById({ workId: String(panel.work_id), participantId: input.participantId, client: db });
  if (!work) throw new Error("Storyboard was not found.");
  const ordered = applyOrder(work.panels, work.panels.map((item) => item.panel_id));
  for (const item of ordered) {
    await db.from("storyboard_panel").update({ sequence: item.sequence + 10_000 }).eq("panel_id", item.panel_id);
  }
  for (const item of ordered) {
    await db.from("storyboard_panel").update({ sequence: item.sequence }).eq("panel_id", item.panel_id);
  }
  return (await loadStoryboardWorkById({ workId: work.work_id, participantId: input.participantId, client: db })) as StoryboardWorkRecord;
}

export async function reorderStoryboardPanels(input: {
  workId: string;
  participantId: string;
  panelIds: string[];
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  const ordered = applyOrder(work.panels, input.panelIds);
  for (const panel of ordered) {
    await db.from("storyboard_panel").update({ sequence: panel.sequence + 10_000 }).eq("panel_id", panel.panel_id);
  }
  for (const panel of ordered) {
    await db.from("storyboard_panel").update({ sequence: panel.sequence }).eq("panel_id", panel.panel_id);
  }
  await db.from("storyboard_work").update({ updated_at: new Date().toISOString() }).eq("work_id", input.workId);
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function restoreStoryboardSnapshot(input: {
  workId: string;
  participantId: string;
  title?: string;
  body?: string;
  premise?: string | null;
  panels: Array<Partial<StoryboardPanelRecord> & { panel_id: string; sequence: number; title: string }>;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  await db.from("storyboard_work").update({
    title: input.title ?? work.title,
    body: input.body ?? work.body,
    premise: input.premise ?? work.premise,
    updated_at: new Date().toISOString(),
  }).eq("work_id", input.workId);
  const keep = new Set(input.panels.map((panel) => panel.panel_id));
  const existingIds = new Set(work.panels.map((panel) => panel.panel_id));
  for (const panel of work.panels) {
    if (!keep.has(panel.panel_id)) await db.from("storyboard_panel").delete().eq("panel_id", panel.panel_id);
  }
  for (const panel of input.panels) {
    const row = {
      sequence: panel.sequence + 10_000,
      title: panel.title,
      description: panel.description ?? "",
      narrative_purpose: panel.narrative_purpose ?? null,
      action: panel.action ?? null,
      dialogue: panel.dialogue ?? null,
      narration: panel.narration ?? null,
      camera: panel.camera ?? null,
      camera_movement: panel.camera_movement ?? null,
      framing: panel.framing ?? null,
      lens_style: panel.lens_style ?? null,
      lighting: panel.lighting ?? null,
      environment: panel.environment ?? null,
      characters: panel.characters ?? null,
      mood: panel.mood ?? null,
      transition: panel.transition ?? null,
      duration_ms: panel.duration_ms ?? null,
      aspect_ratio: panel.aspect_ratio ?? null,
      active_still_asset_id: panel.active_still_asset_id ?? null,
      active_motion_asset_id: panel.active_motion_asset_id ?? null,
      panel_references: panel.references ?? [],
      user_locked: panel.user_locked === true,
      updated_at: new Date().toISOString(),
    };
    if (existingIds.has(panel.panel_id)) {
      await db.from("storyboard_panel").update(row).eq("panel_id", panel.panel_id);
    }
  }
  for (const panel of input.panels) {
    if (existingIds.has(panel.panel_id)) {
      await db.from("storyboard_panel").update({ sequence: panel.sequence }).eq("panel_id", panel.panel_id);
    } else {
      await db.from("storyboard_panel").insert({
        panel_id: panel.panel_id,
        work_id: input.workId,
        sequence: panel.sequence,
        title: panel.title,
        description: panel.description ?? "",
        camera: panel.camera ?? null,
        camera_movement: panel.camera_movement ?? null,
        transition: panel.transition ?? null,
        duration_ms: panel.duration_ms ?? null,
        status: "draft",
        source: "script",
        panel_references: panel.references ?? [],
        active_still_asset_id: panel.active_still_asset_id ?? null,
        active_motion_asset_id: panel.active_motion_asset_id ?? null,
      });
    }
  }
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function resetStoryboardWork(input: {
  workId: string;
  participantId: string;
  scope: "saved" | "initial" | "panel-artifacts" | "panel";
  panelId?: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  if (input.scope === "saved" || input.scope === "panel") {
    return work;
  }
  if (input.scope === "panel-artifacts" && input.panelId) {
    await db.from("storyboard_panel").update({
      active_still_asset_id: null,
      active_motion_asset_id: null,
      updated_at: new Date().toISOString(),
    }).eq("panel_id", input.panelId);
  }
  if (input.scope === "initial") {
    await db.from("storyboard_work").update({
      body: "",
      premise: null,
      title: "Untitled storyboard",
      updated_at: new Date().toISOString(),
    }).eq("work_id", input.workId);
    await db.from("storyboard_panel").delete().eq("work_id", input.workId).eq("user_locked", false);
  }
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function attachStoryboardSource(input: {
  workId: string;
  participantId: string;
  assetId: string;
  title?: string;
  category?: "source" | "reference" | "generated";
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  const { data: asset } = await db
    .from("media_asset")
    .select("asset_id, storage_ref, provider, provider_asset_id, duration_ms")
    .eq("asset_id", input.assetId)
    .maybeSingle();
  if (!asset) throw new Error("Media asset was not found.");
  const { data: variant } = await db.from("delivery_variant").select("endpoint_ref").eq("asset_id", input.assetId).maybeSingle();
  const playbackId = asset.provider === "mux" ? asset.storage_ref : null;
  await db.from("media_intake").insert({
    master_id: work.universe_id,
    asset_id: asset.asset_id,
    title: input.title ?? "Storyboard source",
    work_type: "video",
    source_type: "other",
    source_provider: asset.provider,
    external_identifier: asset.provider_asset_id,
    supplied_by: input.participantId,
    isrc_status: "not-applicable",
    provenance_notes: storyboardSourceNotes({
      work_id: input.workId,
      title: input.title ?? "Source media",
      asset_id: asset.asset_id,
      mux_asset_id: asset.provider_asset_id,
      playback_id: playbackId,
      endpoint_ref: variant?.endpoint_ref ?? (playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null),
      still_url: playbackId ? muxThumbnailUrl(playbackId, 0, 640) : null,
      duration_ms: asset.duration_ms,
      category: input.category ?? "source",
    }),
  });
  await db.from("storyboard_work").update({ updated_at: new Date().toISOString() }).eq("work_id", input.workId);
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function deriveStoryboardFrame(input: {
  workId: string;
  participantId: string;
  playbackId: string;
  timestampMs: number;
  sourceTitle: string;
  panelId?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const stillUrl = muxThumbnailUrl(input.playbackId, Math.max(0, input.timestampMs / 1000), 1280);
  const db = svc(input.client);
  await db.from("media_intake").insert({
    master_id: work.universe_id,
    title: `${input.sourceTitle} · frame`,
    work_type: "other",
    source_type: "other",
    source_provider: "mux",
    supplied_by: input.participantId,
    isrc_status: "not-applicable",
    provenance_notes: storyboardFrameNotes({
      work_id: input.workId,
      source_title: input.sourceTitle,
      timestamp_ms: input.timestampMs,
      playback_id: input.playbackId,
      still_url: stillUrl,
      panel_id: input.panelId ?? null,
    }),
  });
  if (input.panelId) {
    const panel = work.panels.find((item) => item.panel_id === input.panelId);
    if (panel) {
      const exists = panel.references.some((reference) => reference.url === stillUrl && reference.time_ms === input.timestampMs);
      if (!exists) {
        await updateStoryboardPanel({
          participantId: input.participantId,
          panelId: input.panelId,
          lock: false,
          patch: {
            references: [
              ...panel.references,
              {
                role: "still",
                label: `${input.sourceTitle} @ ${Math.round(input.timestampMs / 1000)}s`,
                url: stillUrl,
                time_ms: input.timestampMs,
                source_title: input.sourceTitle,
              },
            ],
          },
          client: db,
        });
      }
    }
  }
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

export async function saveStoryboardAssembly(input: {
  workId: string;
  participantId: string;
  items: StoryboardAssemblyRecord["items"];
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const db = svc(input.client);
  const notes = storyboardAssemblyNotes({ work_id: input.workId, items: input.items });
  const { data: existing } = await db
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId)
    .ilike("provenance_notes", `%${input.workId}%`);
  const current = (existing ?? []).find((row) => parseStoryboardAssembly(row.provenance_notes)?.work_id === input.workId);
  if (current) {
    await db.from("media_intake").update({ provenance_notes: notes, updated_at: new Date().toISOString() }).eq("intake_id", current.intake_id);
  } else {
    await db.from("media_intake").insert({
      master_id: work.universe_id,
      title: "Storyboard assembly",
      work_type: "other",
      source_type: "other",
      supplied_by: input.participantId,
      isrc_status: "not-applicable",
      provenance_notes: notes,
    });
  }
  await db.from("storyboard_work").update({ updated_at: new Date().toISOString() }).eq("work_id", input.workId);
  return (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
}

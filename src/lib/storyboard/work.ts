import { randomUUID } from "node:crypto";
import { getServiceClient } from "../authority/validate";
import type { StructuredStoryboard } from "../ai/structured-storyboard";
import { muxThumbnailUrl } from "../media/thumbnail";
import { composeStoryboardBody } from "./script";
import { parseStoryboardBody } from "./artifact";
import { signCreativePath } from "./storage";
import type {
  StoryboardPanelRecord,
  StoryboardPanelSource,
  StoryboardReference,
  StoryboardWorkRecord,
} from "./document";

type ServiceClient = ReturnType<typeof getServiceClient>;

function svc(client?: ServiceClient) {
  return client ?? getServiceClient();
}

function asReferences(value: unknown): StoryboardReference[] {
  if (!Array.isArray(value)) return [];
  const refs: StoryboardReference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.role !== "string" || typeof record.label !== "string") continue;
    refs.push({
      role: record.role as StoryboardReference["role"],
      label: record.label,
      asset_id: typeof record.asset_id === "string" ? record.asset_id : null,
      url: typeof record.url === "string" ? record.url : null,
    });
  }
  return refs;
}

function mapPanel(row: Record<string, unknown>, stillUrl: string | null, motion: { playback_id: string | null; endpoint: string | null }): StoryboardPanelRecord {
  return {
    panel_id: String(row.panel_id),
    work_id: String(row.work_id),
    sequence: Number(row.sequence),
    title: String(row.title),
    description: typeof row.description === "string" ? row.description : "",
    narrative_purpose: typeof row.narrative_purpose === "string" ? row.narrative_purpose : null,
    action: typeof row.action === "string" ? row.action : null,
    dialogue: typeof row.dialogue === "string" ? row.dialogue : null,
    narration: typeof row.narration === "string" ? row.narration : null,
    camera: typeof row.camera === "string" ? row.camera : null,
    camera_movement: typeof row.camera_movement === "string" ? row.camera_movement : null,
    framing: typeof row.framing === "string" ? row.framing : null,
    lens_style: typeof row.lens_style === "string" ? row.lens_style : null,
    lighting: typeof row.lighting === "string" ? row.lighting : null,
    environment: typeof row.environment === "string" ? row.environment : null,
    characters: typeof row.characters === "string" ? row.characters : null,
    mood: typeof row.mood === "string" ? row.mood : null,
    transition: typeof row.transition === "string" ? row.transition : null,
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : null,
    aspect_ratio: typeof row.aspect_ratio === "string" ? row.aspect_ratio : null,
    status: row.status === "ready" || row.status === "generating" ? row.status : "draft",
    source: (row.source as StoryboardPanelSource) || "script",
    proposed_scene_id: typeof row.proposed_scene_id === "string" ? row.proposed_scene_id : null,
    sentinel_panel_id: typeof row.sentinel_panel_id === "string" ? row.sentinel_panel_id : null,
    active_still_asset_id: typeof row.active_still_asset_id === "string" ? row.active_still_asset_id : null,
    active_motion_asset_id: typeof row.active_motion_asset_id === "string" ? row.active_motion_asset_id : null,
    still_url: stillUrl,
    motion_playback_id: motion.playback_id,
    motion_endpoint: motion.endpoint,
    references: asReferences(row.panel_references),
    user_locked: row.user_locked === true,
    creates_scene: false,
  };
}

export async function loadStoryboardWork(input: {
  participantId: string;
  universeId: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord | null> {
  const db = svc(input.client);
  let query = db
    .from("storyboard_work")
    .select("*")
    .eq("participant_id", input.participantId)
    .order("updated_at", { ascending: false })
    .limit(1);
  query = input.universeId ? query.eq("universe_id", input.universeId) : query.is("universe_id", null);
  const { data: work } = await query.maybeSingle();
  if (!work) return null;
  return hydrateWork(db, work as Record<string, unknown>);
}

async function hydrateWork(db: ServiceClient, work: Record<string, unknown>): Promise<StoryboardWorkRecord> {
  const { data: panels } = await db
    .from("storyboard_panel")
    .select("*")
    .eq("work_id", work.work_id)
    .order("sequence", { ascending: true });

  const assetIds = [
    ...new Set(
      (panels ?? [])
        .flatMap((panel) => [panel.active_still_asset_id, panel.active_motion_asset_id])
        .filter(Boolean) as string[],
    ),
  ];
  const { data: assets } = assetIds.length
    ? await db.from("media_asset").select("asset_id, storage_ref, provider, media_class").in("asset_id", assetIds)
    : { data: [] as { asset_id: string; storage_ref: string; provider: string | null; media_class: string | null }[] };
  const { data: variants } = assetIds.length
    ? await db.from("delivery_variant").select("asset_id, endpoint_ref").in("asset_id", assetIds)
    : { data: [] as { asset_id: string; endpoint_ref: string }[] };
  const assetById = new Map((assets ?? []).map((asset) => [asset.asset_id, asset]));
  const endpointById = new Map((variants ?? []).map((row) => [row.asset_id, row.endpoint_ref]));
  const signedStills = new Map<string, string | null>();
  await Promise.all(
    (assets ?? []).map(async (asset) => {
      if (asset.provider === "mux") return;
      if (asset.storage_ref.startsWith("http")) {
        signedStills.set(asset.asset_id, asset.storage_ref);
        return;
      }
      signedStills.set(asset.asset_id, await signCreativePath(asset.storage_ref));
    }),
  );

  return {
    work_id: String(work.work_id),
    universe_id: typeof work.universe_id === "string" ? work.universe_id : null,
    participant_id: String(work.participant_id),
    title: String(work.title ?? "Untitled storyboard"),
    premise: typeof work.premise === "string" ? work.premise : null,
    body: typeof work.body === "string" ? work.body : "",
    tone: typeof work.tone === "string" ? work.tone : null,
    genre: typeof work.genre === "string" ? work.genre : null,
    audience: typeof work.audience === "string" ? work.audience : null,
    creative_intent: typeof work.creative_intent === "string" ? work.creative_intent : null,
    status: typeof work.status === "string" ? work.status : "draft",
    source: typeof work.source === "string" ? work.source : "script",
    panels: (panels ?? []).map((panel) => {
      const stillAsset = panel.active_still_asset_id ? assetById.get(panel.active_still_asset_id) : null;
      const motionAsset = panel.active_motion_asset_id ? assetById.get(panel.active_motion_asset_id) : null;
      const stillUrl = stillAsset
        ? stillAsset.provider === "mux"
          ? muxThumbnailUrl(stillAsset.storage_ref, 0, 640)
          : signedStills.get(stillAsset.asset_id) ?? (stillAsset.storage_ref.startsWith("http") ? stillAsset.storage_ref : null)
        : null;
      return mapPanel(panel as Record<string, unknown>, stillUrl, {
        playback_id: motionAsset?.provider === "mux" ? motionAsset.storage_ref : null,
        endpoint: panel.active_motion_asset_id ? endpointById.get(panel.active_motion_asset_id) ?? null : null,
      });
    }),
    creates_scene: false,
    creates_canonical: false,
  };
}

export async function ensureStoryboardWork(input: {
  participantId: string;
  universeId: string | null;
  title?: string;
  body?: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const existing = await loadStoryboardWork(input);
  if (existing) {
    if (input.body != null && input.body !== existing.body && !panelsLocked(existing)) {
      return saveStoryboardBody({ ...input, workId: existing.work_id, body: input.body, title: input.title ?? existing.title });
    }
    return existing;
  }
  const db = svc(input.client);
  const { data, error } = await db
    .from("storyboard_work")
    .insert({
      universe_id: input.universeId,
      participant_id: input.participantId,
      title: input.title ?? "Untitled storyboard",
      body: input.body ?? "",
      source: "script",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create storyboard work.");
  return hydrateWork(db, data as Record<string, unknown>);
}

function panelsLocked(work: StoryboardWorkRecord) {
  return work.panels.some((panel) => panel.user_locked);
}

export async function loadStoryboardWorkById(input: {
  workId: string;
  participantId: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord | null> {
  const db = svc(input.client);
  const { data } = await db
    .from("storyboard_work")
    .select("*")
    .eq("work_id", input.workId)
    .eq("participant_id", input.participantId)
    .maybeSingle();
  if (!data) return null;
  return hydrateWork(db, data as Record<string, unknown>);
}

export async function saveStoryboardBody(input: {
  participantId: string;
  universeId: string | null;
  workId?: string;
  title?: string;
  body: string;
  premise?: string | null;
  tone?: string | null;
  genre?: string | null;
  audience?: string | null;
  creative_intent?: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const existing = input.workId
    ? await loadStoryboardWorkById({ workId: input.workId, participantId: input.participantId, client: db })
    : await ensureStoryboardWork(input);
  if (!existing) throw new Error("Storyboard was not found.");
  await db
    .from("storyboard_work")
    .update({
      title: input.title ?? existing.title,
      body: input.body,
      premise: input.premise ?? existing.premise,
      tone: input.tone ?? existing.tone,
      genre: input.genre ?? existing.genre,
      audience: input.audience ?? existing.audience,
      creative_intent: input.creative_intent ?? existing.creative_intent,
      updated_at: new Date().toISOString(),
    })
    .eq("work_id", existing.work_id);
  return (await loadStoryboardWorkById({
    workId: existing.work_id,
    participantId: input.participantId,
    client: db,
  })) as StoryboardWorkRecord;
}

export async function replaceStoryboardPanels(input: {
  workId: string;
  participantId: string;
  storyboard: StructuredStoryboard;
  source?: StoryboardPanelSource;
  replaceUnlockedOnly?: boolean;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const db = svc(input.client);
  const current = await db.from("storyboard_work").select("*").eq("work_id", input.workId).eq("participant_id", input.participantId).maybeSingle();
  if (!current.data) throw new Error("Storyboard was not found.");
  const existing = await hydrateWork(db, current.data as Record<string, unknown>);
  const locked = new Map(existing.panels.filter((panel) => panel.user_locked).map((panel) => [panel.sequence, panel]));

  await db.from("storyboard_work").update({
    title: input.storyboard.title || existing.title,
    premise: input.storyboard.premise,
    body: input.storyboard.body || existing.body,
    tone: input.storyboard.tone,
    genre: input.storyboard.genre,
    audience: input.storyboard.audience,
    creative_intent: input.storyboard.creative_intent,
    source: input.source === "sentinel" ? "hybrid" : input.source ?? "ai",
    updated_at: new Date().toISOString(),
  }).eq("work_id", input.workId);

  if (!input.replaceUnlockedOnly) {
    await db.from("storyboard_panel").delete().eq("work_id", input.workId).eq("user_locked", false);
  } else {
    await db.from("storyboard_panel").delete().eq("work_id", input.workId).eq("user_locked", false);
  }

  const rows = input.storyboard.panels
    .filter((panel) => !locked.has(panel.sequence))
    .map((panel) => ({
      work_id: input.workId,
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
      duration_ms: panel.duration_seconds ? panel.duration_seconds * 1000 : null,
      aspect_ratio: panel.aspect_ratio,
      status: "draft",
      source: input.source ?? "ai",
      user_locked: false,
    }));
  const used = new Set(existing.panels.filter((panel) => panel.user_locked).map((panel) => panel.sequence));
  let nextSequence = 1;
  const sequenced = rows.map((row) => {
    while (used.has(nextSequence)) nextSequence += 1;
    const sequence = nextSequence;
    used.add(sequence);
    nextSequence += 1;
    return { ...row, sequence };
  });
  if (sequenced.length) {
    const { error } = await db.from("storyboard_panel").insert(sequenced);
    if (error) throw new Error(error.message);
  }
  return (await loadStoryboardWorkById({
    workId: input.workId,
    participantId: input.participantId,
    client: db,
  })) as StoryboardWorkRecord;
}

export async function updateStoryboardPanel(input: {
  participantId: string;
  panelId: string;
  patch: Partial<Omit<StoryboardPanelRecord, "panel_id" | "work_id" | "creates_scene">>;
  client?: ServiceClient;
}): Promise<StoryboardPanelRecord | null> {
  const db = svc(input.client);
  const { data: panel } = await db.from("storyboard_panel").select("*, storyboard_work!inner(participant_id, universe_id)").eq("panel_id", input.panelId).maybeSingle();
  if (!panel || (panel as { storyboard_work?: { participant_id?: string } }).storyboard_work?.participant_id !== input.participantId) {
    return null;
  }
  const creativeLockFields = new Set([
    "title",
    "description",
    "narrative_purpose",
    "action",
    "dialogue",
    "narration",
    "camera",
    "camera_movement",
    "framing",
    "lens_style",
    "lighting",
    "environment",
    "characters",
    "mood",
    "transition",
    "duration_ms",
    "aspect_ratio",
    "sequence",
    "references",
  ]);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (Object.keys(input.patch).some((key) => creativeLockFields.has(key))) {
    patch.user_locked = true;
  }
  const allowed = [
    "title",
    "description",
    "narrative_purpose",
    "action",
    "dialogue",
    "narration",
    "camera",
    "camera_movement",
    "framing",
    "lens_style",
    "lighting",
    "environment",
    "characters",
    "mood",
    "transition",
    "duration_ms",
    "aspect_ratio",
    "proposed_scene_id",
    "active_still_asset_id",
    "active_motion_asset_id",
    "sequence",
    "status",
  ];
  for (const key of allowed) {
    if (key in input.patch) patch[key] = input.patch[key as keyof typeof input.patch];
  }
  if (input.patch.references) patch.panel_references = input.patch.references;
  await db.from("storyboard_panel").update(patch).eq("panel_id", input.panelId);
  const work = await loadStoryboardWork({
    participantId: input.participantId,
    universeId: (panel as { storyboard_work?: { universe_id?: string | null } }).storyboard_work?.universe_id ?? null,
    client: db,
  });
  return work?.panels.find((item) => item.panel_id === input.panelId) ?? null;
}

export async function seedPanelsFromScript(input: {
  workId: string;
  participantId: string;
  body: string;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord> {
  const composed = composeStoryboardBody(input.body);
  const storyboard: StructuredStoryboard = {
    title: "Storyboard",
    premise: null,
    body: composed.body,
    tone: null,
    genre: null,
    audience: null,
    creative_intent: null,
    panels: composed.panels.map((panel) => ({
      sequence: panel.sequence,
      title: panel.title,
      description: panel.description,
      narrative_purpose: null,
      action: panel.description,
      dialogue: null,
      narration: null,
      camera: panel.camera,
      camera_movement: panel.movement,
      framing: null,
      lens_style: null,
      lighting: null,
      environment: null,
      characters: null,
      mood: null,
      transition: panel.transition,
      duration_seconds: null,
      aspect_ratio: null,
    })),
    creates_scene: false,
    creates_canonical: false,
  };
  return replaceStoryboardPanels({
    workId: input.workId,
    participantId: input.participantId,
    storyboard,
    source: "script",
  });
}

export async function importLegacyStoryboardBody(input: {
  participantId: string;
  universeId: string | null;
  client?: ServiceClient;
}): Promise<StoryboardWorkRecord | null> {
  const existing = await loadStoryboardWork(input);
  if (existing) return existing;
  const db = svc(input.client);
  let query = db.from("media_intake").select("provenance_notes").eq("supplied_by", input.participantId).order("updated_at", { ascending: false });
  query = input.universeId ? query.eq("master_id", input.universeId) : query.is("master_id", null);
  const { data } = await query;
  const body = (data ?? []).map((row) => parseStoryboardBody(row.provenance_notes)).find(Boolean);
  if (!body?.body) return null;
  const work = await ensureStoryboardWork({ ...input, body: body.body, title: "Storyboard" });
  if (!work.panels.length && body.body) {
    return seedPanelsFromScript({ workId: work.work_id, participantId: input.participantId, body: body.body, client: db });
  }
  return work;
}

export function newPanelId() {
  return randomUUID();
}

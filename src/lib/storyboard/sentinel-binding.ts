/**
 * Bind Sentinel cinematic shots to Storyboard panels and references.
 * Observational proposals do not lock creator fields. Never creates Scenes.
 */

import { getServiceClient } from "../authority/validate";
import {
  cinematicToPanelProposal,
  subjectsLine,
  type CinematicShot,
} from "../media/cinematic-evidence";
import type { SentinelObservationRecord, StoryboardWorkRecord } from "./document";
import {
  parseStoryboardSelection,
  storyboardFrameNotes,
  storyboardSelectionNotes,
} from "./source";
import { createStoryboardPanel, deriveStoryboardFrame } from "./commands";
import { loadStoryboardWorkById, updateStoryboardPanel } from "./work";

type ServiceClient = ReturnType<typeof getServiceClient>;

function svc(client?: ServiceClient) {
  return client ?? getServiceClient();
}

export function observationFromShot(shot: CinematicShot): SentinelObservationRecord {
  return {
    shot_id: shot.shot_id,
    start_ms: shot.start_ms,
    end_ms: shot.end_ms,
    time_ms: shot.time_ms,
    what_happens: shot.what_happens,
    camera: shot.camera,
    camera_explanation: shot.camera_explanation,
    framing: shot.framing,
    motion: shot.motion,
    action: shot.action,
    subjects: subjectsLine(shot.subjects),
    environment: shot.environment,
    lighting: shot.lighting,
    transition: shot.transition,
    narrative: shot.narrative,
    confidence: shot.confidence,
    analysis_mode: shot.analysis_mode,
    still_url: shot.still_url,
    creates_scene: false,
  };
}

export async function persistStoryboardSelection(input: {
  workId: string;
  participantId: string;
  shotId: string;
  panelId: string | null;
  client?: ServiceClient;
}): Promise<void> {
  const db = svc(input.client);
  const { data } = await db
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId)
    .ilike("provenance_notes", `%${input.workId}%`);
  const existing = (data ?? []).find((row) => parseStoryboardSelection(row.provenance_notes)?.work_id === input.workId);
  const notes = storyboardSelectionNotes({
    work_id: input.workId,
    shot_id: input.shotId,
    panel_id: input.panelId,
  });
  if (existing) {
    await db.from("media_intake").update({ provenance_notes: notes, updated_at: new Date().toISOString() }).eq("intake_id", existing.intake_id);
    return;
  }
  await db.from("media_intake").insert({
    title: "Storyboard selection",
    work_type: "other",
    source_type: "other",
    supplied_by: input.participantId,
    isrc_status: "not-applicable",
    provenance_notes: notes,
  });
}

async function applyShotToPanel(input: {
  participantId: string;
  panelId: string;
  shot: CinematicShot;
  lock: boolean;
  metadata?: import("./document").PanelGenerationMetadata;
  client?: ServiceClient;
}) {
  const proposed = cinematicToPanelProposal(input.shot);
  const observation = observationFromShot(input.shot);
  await updateStoryboardPanel({
    participantId: input.participantId,
    panelId: input.panelId,
    lock: input.lock,
    client: input.client,
    patch: {
      title: proposed.title,
      description: proposed.description,
      action: proposed.action,
      camera: proposed.camera,
      camera_movement: proposed.camera_movement,
      framing: proposed.framing,
      environment: proposed.environment,
      lighting: proposed.lighting,
      characters: proposed.characters,
      transition: proposed.transition,
      narrative_purpose: proposed.narrative_purpose,
      duration_ms: proposed.duration_ms,
      sentinel_panel_id: input.shot.shot_id,
      source: "sentinel",
      generation_metadata: {
        ...(input.metadata ?? {}),
        sentinel_observation: observation,
      },
    },
  });
}

export async function selectSentinelShot(input: {
  workId: string;
  participantId: string;
  shot: CinematicShot;
  client?: ServiceClient;
}): Promise<{ work: StoryboardWorkRecord; panelId: string; created: boolean }> {
  const current = await loadStoryboardWorkById(input);
  if (!current) throw new Error("Storyboard was not found.");
  const existing = current.panels.find((panel) => panel.sentinel_panel_id === input.shot.shot_id);
  if (existing) {
    if (!existing.user_locked) {
      await applyShotToPanel({
        participantId: input.participantId,
        panelId: existing.panel_id,
        shot: input.shot,
        lock: false,
        metadata: existing.generation_metadata,
        client: input.client,
      });
    } else {
      await updateStoryboardPanel({
        participantId: input.participantId,
        panelId: existing.panel_id,
        lock: false,
        client: input.client,
        patch: {
          sentinel_panel_id: input.shot.shot_id,
          generation_metadata: {
            ...existing.generation_metadata,
            sentinel_observation: observationFromShot(input.shot),
          },
        },
      });
    }
    await persistStoryboardSelection({
      workId: input.workId,
      participantId: input.participantId,
      shotId: input.shot.shot_id,
      panelId: existing.panel_id,
      client: input.client,
    });
    const work = (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
    return { work, panelId: existing.panel_id, created: false };
  }

  const created = await createStoryboardPanel({
    workId: input.workId,
    participantId: input.participantId,
    title: cinematicToPanelProposal(input.shot).title,
    description: input.shot.what_happens,
    stillUrl: input.shot.still_url,
    timeMs: input.shot.time_ms,
    sentinelPanelId: input.shot.shot_id,
    durationMs: input.shot.duration_ms,
    source: "sentinel",
    sourceTitle: "Sentinel observation",
    client: input.client,
  });
  const panel = created.panels.find((item) => item.sentinel_panel_id === input.shot.shot_id) ?? created.panels[created.panels.length - 1];
  if (!panel) throw new Error("Sentinel shot could not become a panel.");
  await applyShotToPanel({
    participantId: input.participantId,
    panelId: panel.panel_id,
    shot: input.shot,
    lock: false,
    metadata: panel.generation_metadata,
    client: input.client,
  });
  await persistStoryboardSelection({
    workId: input.workId,
    participantId: input.participantId,
    shotId: input.shot.shot_id,
    panelId: panel.panel_id,
    client: input.client,
  });
  const work = (await loadStoryboardWorkById(input)) as StoryboardWorkRecord;
  return { work, panelId: panel.panel_id, created: true };
}

export function referenceKey(playbackId: string | null, timeMs: number): string {
  return `${playbackId ?? "none"}:${Math.round(timeMs)}`;
}

export async function addSentinelReferences(input: {
  workId: string;
  participantId: string;
  shots: CinematicShot[];
  playbackId: string;
  panelId?: string | null;
  client?: ServiceClient;
}): Promise<{ work: StoryboardWorkRecord; added: number; skipped: number; panelId: string | null }> {
  let work = await loadStoryboardWorkById(input);
  if (!work) throw new Error("Storyboard was not found.");
  const existing = new Set((work.frames ?? []).map((frame) => referenceKey(frame.playback_id, frame.timestamp_ms)));
  let added = 0;
  let skipped = 0;
  const panelId = input.panelId ?? work.selection?.panel_id ?? null;
  for (const shot of input.shots) {
    const key = referenceKey(input.playbackId, shot.time_ms);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    work = await deriveStoryboardFrame({
      workId: input.workId,
      participantId: input.participantId,
      playbackId: input.playbackId,
      timestampMs: shot.time_ms,
      sourceTitle: cinematicToPanelProposal(shot).title,
      panelId,
      client: input.client,
    });
    existing.add(key);
    added += 1;
  }
  return { work, added, skipped, panelId };
}

export async function addSentinelShotsToStoryboard(input: {
  workId: string;
  participantId: string;
  shots: CinematicShot[];
  client?: ServiceClient;
}): Promise<{ work: StoryboardWorkRecord; panelIds: string[] }> {
  const panelIds: string[] = [];
  let work: StoryboardWorkRecord | null = null;
  for (const shot of input.shots) {
    const selected = await selectSentinelShot({
      workId: input.workId,
      participantId: input.participantId,
      shot,
      client: input.client,
    });
    work = selected.work;
    panelIds.push(selected.panelId);
  }
  if (!work) throw new Error("Storyboard was not found.");
  return { work, panelIds };
}

export { storyboardFrameNotes, svc };

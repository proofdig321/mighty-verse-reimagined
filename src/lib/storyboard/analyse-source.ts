/**
 * Run cinematic Sentinel analysis against Storyboard source media.
 * Uses the attached source, never Super Hero Ego canonical media by inference.
 */

import { analyseSourceCinematically } from "../ai/cinematic-analysis";
import { getServiceClient } from "../authority/validate";
import { parseCinematicFromParameters, type CinematicAnalysis } from "../media/cinematic-evidence";
import { getInspectionSession, listInspectionSessions, persistCinematicAnalysis } from "../media/sentinel";
import type { StoryboardWorkRecord } from "./document";
import { parseStoryboardCinematic, storyboardCinematicNotes } from "./source";

export async function analyseStoryboardSource(input: {
  work: StoryboardWorkRecord;
  participantId: string;
}): Promise<{ analysis: CinematicAnalysis; provider: "gemini" | "fallback"; sessionId: string | null }> {
  const source = input.work.sources?.[0] ?? null;
  if (!source?.playback_id) {
    throw new Error("Attach source media to this Storyboard before running Sentinel. Sentinel analyses the attached source, not Super Hero Ego canonical media.");
  }
  const assetId = source.asset_id;
  let cues: { time_ms: number; mean_luminance: number | null; change_score: number | null; is_boundary_candidate: boolean }[] = [];
  if (assetId) {
    const sessions = await listInspectionSessions(assetId);
    const latest = sessions.find((session) => session.status === "completed") ?? sessions[0] ?? null;
    const detailed = latest ? await getInspectionSession(latest.session_id) : null;
    cues = (detailed?.observations ?? []).map((observation) => ({
      time_ms: observation.time_ms,
      mean_luminance: observation.mean_luminance,
      change_score: observation.change_score,
      is_boundary_candidate: observation.is_boundary_candidate,
    }));
  }
  const result = await analyseSourceCinematically({
    playbackId: source.playback_id,
    assetId,
    durationMs: source.duration_ms,
    cues,
  });
  let sessionId: string | null = null;
  if (assetId) {
    const persisted = await persistCinematicAnalysis({
      assetId,
      initiatedBy: input.participantId,
      durationMs: source.duration_ms,
      cinematic: result.analysis,
    });
    sessionId = persisted.sessionId;
  }
  await persistWorkCinematic({
    workId: input.work.work_id,
    participantId: input.participantId,
    cinematic: result.analysis,
  });
  return { ...result, sessionId };
}

async function persistWorkCinematic(input: {
  workId: string;
  participantId: string;
  cinematic: CinematicAnalysis;
}): Promise<void> {
  const db = getServiceClient();
  const { data } = await db
    .from("media_intake")
    .select("intake_id, provenance_notes")
    .eq("supplied_by", input.participantId)
    .ilike("provenance_notes", `%${input.workId}%`);
  const existing = (data ?? []).find((row) => parseStoryboardCinematic(row.provenance_notes)?.work_id === input.workId);
  const notes = storyboardCinematicNotes({ work_id: input.workId, cinematic: input.cinematic });
  if (existing) {
    await db.from("media_intake").update({ provenance_notes: notes, updated_at: new Date().toISOString() }).eq("intake_id", existing.intake_id);
    return;
  }
  await db.from("media_intake").insert({
    title: "Storyboard cinematic analysis",
    work_type: "other",
    source_type: "other",
    supplied_by: input.participantId,
    isrc_status: "not-applicable",
    provenance_notes: notes,
  });
}

export async function loadStoryboardCinematic(work: StoryboardWorkRecord): Promise<CinematicAnalysis | null> {
  if (work.cinematic) return work.cinematic;
  const source = work.sources?.[0] ?? null;
  if (!source?.asset_id) return null;
  const sessions = await listInspectionSessions(source.asset_id);
  const latest = sessions.find((session) => session.status === "completed") ?? sessions[0] ?? null;
  if (!latest) return null;
  const detailed = await getInspectionSession(latest.session_id);
  return parseCinematicFromParameters(detailed?.session.parameters ?? null);
}

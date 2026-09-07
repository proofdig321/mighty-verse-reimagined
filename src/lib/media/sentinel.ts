/**
 * Mighty Verse — Sentinel Persistence Adapter
 *
 * Translates the output of the browser media intelligence analyser into
 * persistent evidence rows (inspection_session + frame_observation).
 *
 * This module is the ONLY place that writes Sentinel evidence to Supabase.
 * It is deliberately decoupled from the analyser so future analysis providers
 * can be swapped without changing the persistence contract.
 *
 * Architecture:
 *
 *   intelligence.ts (analyser)
 *         ↓
 *   SampledFrame[] + FrameDelta[] + candidateTimestampsMs[]
 *         ↓
 *   sentinel.ts (this module — persistence adapter)
 *         ↓
 *   inspection_session + frame_observation (Supabase)
 *
 * Invariants:
 *   - Never writes to master, canonical_state, projection, or binding tables
 *   - Each call to persistInspection creates a NEW session — no overwriting
 *   - analysis_version is explicit so future algorithm changes are distinguishable
 *   - Frame image blobs are NOT persisted — evidence metadata only
 */

import { createClient } from "@supabase/supabase-js";
import type { SampledFrame, FrameDelta, BrowserMediaMetadata } from "@/lib/media/intelligence";

/** Current analysis version. Increment when the algorithm changes. */
export const ANALYSIS_VERSION = "browser-v1" as const;

/** Parameters used during an inspection run. */
export type InspectionParameters = {
  frameCount: number;
  threshold: number;
  minSceneDurationMs: number;
  frameWidth?: number;
  frameHeight?: number;
};

/** Input to the persistence adapter — the full output of one analyser run. */
export type InspectionEvidence = {
  /** The Mighty Verse media_asset.asset_id being inspected. */
  assetId: string;
  /** Participant who initiated the inspection. Null = system/automated. */
  initiatedBy: string | null;
  /** Browser-observed media metadata. */
  metadata: BrowserMediaMetadata;
  /** Sampled frames from the analyser. */
  frames: SampledFrame[];
  /** Frame-to-frame deltas from the analyser. */
  deltas: FrameDelta[];
  /** Boundary candidate timestamps (ms) identified by the detection algorithm. */
  candidateTimestampsMs: number[];
  /** Parameters used for this inspection run. */
  parameters: InspectionParameters;
};

/** Result of a successful persistence operation. */
export type PersistedInspection = {
  sessionId: string;
  assetId: string;
  observationCount: number;
  candidateCount: number;
  analysisVersion: string;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Compute mean luminance from a SampledFrame's luminance array.
 * Returns null if the luminance array is empty.
 */
function meanLuminance(frame: SampledFrame): number | null {
  if (frame.luminance.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < frame.luminance.length; i++) sum += frame.luminance[i];
  return sum / frame.luminance.length;
}

/**
 * Persist one complete inspection run to Supabase.
 *
 * Creates a new inspection_session row and one frame_observation row per
 * sampled frame. Each call creates a new session — historical evidence from
 * previous runs is never overwritten.
 *
 * Frame image blobs (dataUrl) are NOT persisted — evidence metadata only.
 *
 * @throws if the asset does not exist or if the database write fails.
 */
export async function persistInspection(
  evidence: InspectionEvidence
): Promise<PersistedInspection> {
  const svc = getServiceClient();

  // Verify the asset exists before creating a session
  const { data: asset, error: assetErr } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("asset_id", evidence.assetId)
    .maybeSingle();

  if (assetErr) throw new Error(`Asset lookup failed: ${assetErr.message}`);
  if (!asset) throw new Error(`Media asset not found: ${evidence.assetId}`);

  const candidateSet = new Set(evidence.candidateTimestampsMs);

  // Build a delta map: fromMs → changeScore for O(1) lookup
  const deltaMap = new Map<number, number>();
  for (const d of evidence.deltas) deltaMap.set(d.fromMs, d.changeScore);

  // Create the inspection session — started_at and completed_at both use now()
  // so the constraint (completed_at >= started_at) is always satisfied.
  const now = new Date().toISOString();
  const { data: session, error: sessionErr } = await svc
    .from("inspection_session")
    .insert({
      asset_id: evidence.assetId,
      initiated_by: evidence.initiatedBy,
      analysis_version: ANALYSIS_VERSION,
      status: "completed",
      observed_duration_ms: evidence.metadata.durationMs,
      observed_width: evidence.metadata.hasVideo ? evidence.metadata.videoWidth : null,
      observed_height: evidence.metadata.hasVideo ? evidence.metadata.videoHeight : null,
      frame_count: evidence.frames.length,
      candidate_count: evidence.candidateTimestampsMs.length,
      parameters: evidence.parameters,
      started_at: now,
      completed_at: now,
    })
    .select("session_id")
    .single();

  if (sessionErr || !session) {
    throw new Error(`Failed to create inspection session: ${sessionErr?.message}`);
  }

  // Build frame_observation rows — no image blobs
  const observations = evidence.frames.map((frame, index) => ({
    session_id: session.session_id,
    time_ms: frame.timeMs,
    order_index: index,
    mean_luminance: meanLuminance(frame),
    // change_score: the delta whose fromMs matches this frame's timeMs
    // The first frame has no previous frame, so change_score is null
    change_score: deltaMap.get(frame.timeMs) ?? null,
    is_boundary_candidate: candidateSet.has(frame.timeMs),
    analysis_version: ANALYSIS_VERSION,
  }));

  if (observations.length > 0) {
    const { error: obsErr } = await svc
      .from("frame_observation")
      .insert(observations);

    if (obsErr) {
      // Mark session as partial rather than leaving it in completed state
      await svc
        .from("inspection_session")
        .update({ status: "partial", error_message: obsErr.message })
        .eq("session_id", session.session_id);
      throw new Error(`Failed to persist frame observations: ${obsErr.message}`);
    }
  }

  return {
    sessionId: session.session_id,
    assetId: evidence.assetId,
    observationCount: observations.length,
    candidateCount: evidence.candidateTimestampsMs.length,
    analysisVersion: ANALYSIS_VERSION,
  };
}

/**
 * Retrieve a persisted inspection session with its frame observations.
 * Returns null if the session does not exist.
 */
export async function getInspectionSession(sessionId: string): Promise<{
  session: {
    session_id: string;
    asset_id: string;
    analysis_version: string;
    status: string;
    observed_duration_ms: number | null;
    frame_count: number | null;
    candidate_count: number | null;
    parameters: Record<string, unknown> | null;
    started_at: string;
    completed_at: string | null;
  };
  observations: {
    observation_id: string;
    time_ms: number;
    order_index: number;
    mean_luminance: number | null;
    change_score: number | null;
    is_boundary_candidate: boolean;
  }[];
} | null> {
  const svc = getServiceClient();

  const { data: session, error: se } = await svc
    .from("inspection_session")
    .select("session_id, asset_id, analysis_version, status, observed_duration_ms, frame_count, candidate_count, parameters, started_at, completed_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (se || !session) return null;

  const { data: observations } = await svc
    .from("frame_observation")
    .select("observation_id, time_ms, order_index, mean_luminance, change_score, is_boundary_candidate")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  return {
    session: session as typeof session & { parameters: Record<string, unknown> | null },
    observations: observations ?? [],
  };
}

/**
 * List inspection sessions for a given media asset, most recent first.
 */
export async function listInspectionSessions(assetId: string): Promise<{
  session_id: string;
  analysis_version: string;
  status: string;
  frame_count: number | null;
  candidate_count: number | null;
  started_at: string;
  completed_at: string | null;
}[]> {
  const svc = getServiceClient();

  const { data } = await svc
    .from("inspection_session")
    .select("session_id, analysis_version, status, frame_count, candidate_count, started_at, completed_at")
    .eq("asset_id", assetId)
    .order("started_at", { ascending: false });

  return data ?? [];
}

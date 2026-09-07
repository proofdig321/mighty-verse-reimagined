import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, logOperation } from "@/lib/authority/validate";
import { persistInspection, listInspectionSessions, type InspectionEvidence } from "@/lib/media/sentinel";

/**
 * POST /api/authority/media/inspect
 *
 * Persists the evidence from one Sentinel inspection run.
 *
 * Body:
 *   asset_id          string   — the media_asset being inspected
 *   master_id         string   — the master that owns this asset (for authority check)
 *   metadata          object   — BrowserMediaMetadata from the analyser
 *   frames            array    — SampledFrame[] (dataUrl stripped server-side)
 *   deltas            array    — FrameDelta[]
 *   candidateTimestampsMs  number[]
 *   parameters        object   — InspectionParameters
 *
 * Authority: requires authorise-projection capability on the master.
 * This reuses the existing projection authority as the gate for evidence writes —
 * if you can bind media to a projection, you can record evidence about that media.
 *
 * Returns: { session_id, observation_count, candidate_count }
 *
 * GET /api/authority/media/inspect?asset_id=...
 *
 * Lists inspection sessions for a given asset.
 */

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json();
  const { asset_id, master_id, metadata, frames, deltas, candidateTimestampsMs, parameters } = body;

  if (!asset_id) return NextResponse.json({ error: "asset_id required" }, { status: 400 });
  if (!master_id) return NextResponse.json({ error: "master_id required" }, { status: 400 });
  if (!metadata || !Array.isArray(frames) || !Array.isArray(deltas) || !Array.isArray(candidateTimestampsMs)) {
    return NextResponse.json({ error: "metadata, frames, deltas, and candidateTimestampsMs required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  // Strip dataUrl from frames before persistence — we store evidence metadata only
  const strippedFrames = (frames as Array<{ timeMs: number; timeSec: number; luminance: number[]; width: number; height: number; dataUrl?: string }>).map(
    ({ dataUrl: _dataUrl, ...rest }) => ({
      ...rest,
      // Reconstruct Float32Array from the serialised number array
      luminance: new Float32Array(rest.luminance ?? []),
    })
  );

  const evidence: InspectionEvidence = {
    assetId: asset_id,
    initiatedBy: participantId,
    metadata,
    frames: strippedFrames as InspectionEvidence["frames"],
    deltas,
    candidateTimestampsMs,
    parameters: parameters ?? { frameCount: frames.length, threshold: 0.15, minSceneDurationMs: 3000 },
  };

  try {
    const result = await persistInspection(evidence);
    await logOperation(auth.authority_id, "persist-inspection", result.sessionId, "inspection-session", "accepted");
    return NextResponse.json({
      session_id: result.sessionId,
      observation_count: result.observationCount,
      candidate_count: result.candidateCount,
      analysis_version: result.analysisVersion,
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to persist inspection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("asset_id");
  if (!assetId) return NextResponse.json({ error: "asset_id required" }, { status: 400 });

  const sessions = await listInspectionSessions(assetId);
  return NextResponse.json({ sessions });
}

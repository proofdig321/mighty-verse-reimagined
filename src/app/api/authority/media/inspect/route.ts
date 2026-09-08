import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, logOperation } from "@/lib/authority/validate";
import { decideInspectionPersist } from "@/lib/media/inspect-persist";
import { persistInspection, listInspectionSessions, type InspectionEvidence } from "@/lib/media/sentinel";

/**
 * POST /api/authority/media/inspect
 *
 * Persists the evidence from one Sentinel inspection run against a media_asset.
 *
 * Body:
 *   asset_id          string   — the media_asset being inspected (required)
 *   master_id         string   — optional authority context for an existing work
 *   metadata          object   — BrowserMediaMetadata from the analyser
 *   frames            array    — SampledFrame[] (dataUrl stripped server-side)
 *   deltas            array    — FrameDelta[]
 *   candidateTimestampsMs  number[]
 *   parameters        object   — InspectionParameters
 *
 * Authority: requires authorise-projection.
 * Source-media inspection (no master_id) uses platform-scoped authority —
 * the operator may inspect media before it becomes a canonical work.
 * Master-scoped inspection keeps the existing master target.
 *
 * Unauthenticated requests are rejected. Evidence is not public.
 *
 * Returns: { session_id, observation_count, candidate_count }
 *
 * GET /api/authority/media/inspect?asset_id=...
 *
 * Lists inspection sessions for a given asset.
 */

function persistStatus(message: string): number {
  if (message.startsWith("Media asset not found")) return 404;
  return 500;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json();
  const decision = decideInspectionPersist(body);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", decision.master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const { metadata, frames, deltas, candidateTimestampsMs, parameters } = body;

  // Strip dataUrl from frames before persistence — we store evidence metadata only
  const strippedFrames = (frames as Array<{ timeMs: number; timeSec: number; luminance: number[]; width: number; height: number; dataUrl?: string }>).map(
    ({ dataUrl: _dataUrl, ...rest }) => ({
      ...rest,
      // Reconstruct Float32Array from the serialised number array
      luminance: new Float32Array(rest.luminance ?? []),
    })
  );

  const evidence: InspectionEvidence = {
    assetId: decision.asset_id,
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
    return NextResponse.json({ error: msg }, { status: persistStatus(msg) });
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

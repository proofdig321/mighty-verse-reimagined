import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/authority/validate";
import { advanceUploadSession } from "@/lib/media/upload-advance";

/**
 * GET /api/authority/media/upload-session/[sessionId]
 *
 * Polls the upload session and advances it from live Mux state.
 * Webhooks are optional. A missed webhook must not stall Create Work.
 * If Mux is unreachable, the current database phase is still returned.
 *
 * Note: the path parameter is session_id (Mighty Verse UUID),
 * not the provider asset ID.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId: sessionId } = await params;

  try {
    const advanced = await advanceUploadSession(sessionId);
    if (advanced) {
      return NextResponse.json({
        session_id: advanced.session_id,
        phase: advanced.phase,
        provider: advanced.provider,
        asset_id: advanced.asset_id,
        updated_at: advanced.updated_at,
        outcome: advanced.outcome,
        provider_status: advanced.provider_status,
      });
    }
  } catch (err) {
    console.error("[upload-session GET] advance failed:", err instanceof Error ? err.message : err);
  }

  const svc = getServiceClient();
  const { data: session, error } = await svc
    .from("media_upload_session")
    .select("session_id, phase, provider, provider_asset_id, asset_id, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    session_id: session.session_id,
    phase: session.phase,
    provider: session.provider,
    asset_id: session.asset_id ?? null,
    updated_at: session.updated_at,
    outcome:
      session.phase === "ingested" || session.phase === "ready"
        ? "ingested"
        : session.phase === "failed"
          ? "failed"
          : "in_progress",
    provider_status: null,
  });
}

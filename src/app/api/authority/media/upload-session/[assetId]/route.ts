import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/authority/validate";

/**
 * GET /api/authority/media/upload-session/[sessionId]
 *
 * Polls the upload session phase from the database.
 * Phase is updated by the Mux webhook handler — no provider API call needed here.
 * The UI polls this endpoint to know when the asset is ready.
 *
 * Note: the path parameter is now session_id (Mighty Verse UUID),
 * not the provider asset ID. The UI must pass session_id from the
 * upload session creation response.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId: sessionId } = await params;
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
    // asset_id is the Mighty Verse canonical UUID — set when ingested
    asset_id: session.asset_id ?? null,
    updated_at: session.updated_at,
  });
}

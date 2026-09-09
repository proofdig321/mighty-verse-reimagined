import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority } from "@/lib/authority/validate";
import { advanceUploadSession } from "@/lib/media/upload-advance";

/**
 * POST /api/authority/media/reconcile
 *
 * Recovers a media_upload_session from live Mux state when the webhook
 * was missed. Same advance path as polling — no second ingest implementation.
 *
 * Authority: requires platform authority (create-canonical-state).
 * Creates media_asset + delivery_variant only. Does not bind canonical media.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const { session_id } = await request.json();
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });

  try {
    const advanced = await advanceUploadSession(session_id);
    if (!advanced) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    if (advanced.outcome === "ingested" && advanced.asset_id) {
      return NextResponse.json({
        reconciled: advanced.advanced,
        already_ingested: !advanced.advanced,
        asset_id: advanced.asset_id,
        session_id,
        phase: advanced.phase,
      });
    }

    if (advanced.outcome === "failed") {
      return NextResponse.json({
        error: "Media processing failed at the provider",
        session_id,
        phase: advanced.phase,
        outcome: "failed",
      }, { status: 409 });
    }

    return NextResponse.json({
      error: "Mux asset not yet ready — processing continues",
      session_id,
      phase: advanced.phase,
      outcome: "in_progress",
      provider_status: advanced.provider_status,
    }, { status: 409 });
  } catch (err) {
    console.error("[reconcile] advance failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}

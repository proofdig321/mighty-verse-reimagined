import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";
import { muxUploadCorsOrigin } from "@/lib/media/providers/mux/cors-origin";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";

/**
 * POST /api/authority/storyboard/source
 * Create a Mux Direct Upload for Storyboard source media.
 * Does not create a Universe, Mural, Scene, or Creative Moment.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const workId = typeof body.work_id === "string" ? body.work_id : "";
  const name = typeof body.name === "string" ? body.name : "storyboard-source.mp4";
  if (!workId) return NextResponse.json({ error: "work_id is required.", creates_scene: false }, { status: 400 });

  const work = await loadStoryboardWorkById({ workId, participantId });
  if (!work) return NextResponse.json({ error: "Storyboard was not found.", creates_scene: false }, { status: 404 });

  const svc = getServiceClient();
  const { data: session, error: sessionError } = await svc
    .from("media_upload_session")
    .insert({
      intake_id: null,
      projection_id: null,
      master_id: work.universe_id,
      provider: "mux",
      provider_asset_id: "pending",
      provider_upload_url: null,
      phase: "created",
      created_by: participantId,
    })
    .select("session_id")
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message ?? "Could not create upload session.", creates_scene: false }, { status: 500 });
  }

  try {
    const upload = await muxAdapter.createDirectUpload({
      name,
      passthrough: session.session_id,
      corsOrigin: muxUploadCorsOrigin(request),
    });
    await svc
      .from("media_upload_session")
      .update({
        provider_upload_id: upload.providerUploadId,
        provider_upload_url: upload.uploadUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", session.session_id);
    return NextResponse.json({
      upload_url: upload.uploadUrl,
      session_id: session.session_id,
      provider_upload_id: upload.providerUploadId,
      creates_scene: false,
      creates_canonical: false,
    });
  } catch (caught) {
    await svc.from("media_upload_session").delete().eq("session_id", session.session_id);
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : "Failed to create Mux direct upload.",
      creates_scene: false,
    }, { status: 502 });
  }
}

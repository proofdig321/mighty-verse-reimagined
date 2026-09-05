import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import { livepeer } from "@/lib/livepeer/client";

// Upload sessions older than this in non-terminal phases are considered stale.
// Livepeer upload URLs expire after ~72 hours; we use 48h as the stale threshold.
const STALE_SESSION_HOURS = 48;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { name, projection_id, master_id, intake_id } = await request.json();
  if (!name || !projection_id || !master_id) {
    return NextResponse.json({ error: "name, projection_id, master_id required" }, { status: 400 });
  }

  // Authority gate — same capability as attachMediaBinding
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // Mark stale sessions for this master/projection as failed before creating a new one.
  // Sessions stuck in created/uploading/processing beyond STALE_SESSION_HOURS are expired.
  const staleThreshold = new Date(Date.now() - STALE_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await svc
    .from("media_upload_session")
    .update({ phase: "failed" })
    .eq("master_id", master_id)
    .eq("projection_id", projection_id)
    .in("phase", ["created", "uploading", "processing"])
    .lt("updated_at", staleThreshold);

  // Create Livepeer upload session — LIVEPEER_API_KEY stays server-side
  const result = await livepeer.asset.create({ name });
  if (!result.data) return NextResponse.json({ error: "Failed to create upload session" }, { status: 500 });

  const { url: upload_url, asset } = result.data;
  const provider_asset_id = asset.id;

  // Persist the upload session so it survives browser close / polling interruption
  const { data: session, error: sessionError } = await svc
    .from("media_upload_session")
    .insert({
      intake_id: intake_id ?? null,
      projection_id,
      master_id,
      provider: "livepeer",
      provider_asset_id,
      provider_upload_url: upload_url,
      phase: "created",
      created_by: participantId,
    })
    .select("session_id")
    .single();

  if (sessionError || !session) {
    // Non-fatal: log but don't block the upload
    console.error("Failed to persist upload session:", sessionError?.message);
  }

  return NextResponse.json({
    upload_url,
    asset_id: provider_asset_id,
    session_id: session?.session_id ?? null,
  });
}

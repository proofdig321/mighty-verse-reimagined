import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";
import { DEFAULT_PROVIDER } from "@/lib/media/providers";

// Upload sessions older than this in non-terminal phases are considered stale.
const STALE_SESSION_HOURS = 48;

// CORS origin for Mux Direct Upload.
// In production this must be the actual deployed domain.
// Falls back to a permissive value only in development.
function getUploadCorsOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (origin) return origin.startsWith("http") ? origin : `https://${origin}`;
  // Development fallback — not used in production
  return process.env.NODE_ENV === "production"
    ? "https://mighty-verse.app"
    : "http://localhost:3000";
}

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
  const staleThreshold = new Date(Date.now() - STALE_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await svc
    .from("media_upload_session")
    .update({ phase: "failed" })
    .eq("master_id", master_id)
    .eq("projection_id", projection_id)
    .in("phase", ["created", "uploading", "processing"])
    .lt("updated_at", staleThreshold);

  // Create the session record first so we have session_id for passthrough.
  // provider_upload_id is set after the Mux upload is created.
  // provider_asset_id is set when the webhook fires (video.upload.asset_created).
  const { data: session, error: sessionError } = await svc
    .from("media_upload_session")
    .insert({
      intake_id: intake_id ?? null,
      projection_id,
      master_id,
      provider: DEFAULT_PROVIDER,
      provider_asset_id: "pending", // placeholder — updated by webhook
      provider_upload_url: null,
      phase: "created",
      created_by: participantId,
    })
    .select("session_id")
    .single();

  if (sessionError || !session) {
    console.error("Failed to create upload session record:", sessionError?.message);
    return NextResponse.json({ error: "Failed to create upload session" }, { status: 500 });
  }

  // Create Mux Direct Upload with session_id as passthrough.
  // MUX_TOKEN_ID and MUX_TOKEN_SECRET never leave the server.
  let uploadResult: { uploadUrl: string; providerUploadId: string };
  try {
    uploadResult = await muxAdapter.createDirectUpload({
      name,
      passthrough: session.session_id,
      corsOrigin: getUploadCorsOrigin(),
    });
  } catch (err) {
    // Clean up the session record if Mux upload creation fails
    await svc.from("media_upload_session").delete().eq("session_id", session.session_id);
    console.error("Mux Direct Upload creation failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create provider upload" }, { status: 500 });
  }

  // Update session with provider_upload_id and upload URL
  await svc
    .from("media_upload_session")
    .update({
      provider_upload_id: uploadResult.providerUploadId,
      provider_upload_url: uploadResult.uploadUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", session.session_id);

  return NextResponse.json({
    upload_url: uploadResult.uploadUrl,
    session_id: session.session_id,
    // provider_upload_id returned for UI correlation — not a secret
    provider_upload_id: uploadResult.providerUploadId,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import { muxAdapter, mapMuxAsset } from "@/lib/media/providers/mux/adapter";

/**
 * POST /api/authority/media/reconcile
 *
 * Recovers a media_upload_session where the Mux asset is ready but the
 * webhook was missed (e.g. due to misconfigured MUX_WEBHOOK_SECRET).
 *
 * Fetches the Mux asset state directly via the Mux API and creates
 * media_asset + delivery_variant if they don't exist, then marks the
 * session as ingested.
 *
 * Authority: requires platform authority (create-canonical-state).
 * This is an operator recovery action — not called automatically.
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

  const svc = getServiceClient();

  const { data: session } = await svc
    .from("media_upload_session")
    .select("session_id, phase, provider, provider_upload_id, provider_asset_id, asset_id, intake_id")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.provider !== "mux") return NextResponse.json({ error: "Only Mux sessions can be reconciled via this route" }, { status: 400 });
  if (session.phase === "ingested" && session.asset_id) {
    return NextResponse.json({ already_ingested: true, asset_id: session.asset_id });
  }

  // Fetch Mux upload to get asset_id if not already on session
  let muxAssetId = session.provider_asset_id !== "pending" ? session.provider_asset_id : null;

  if (!muxAssetId && session.provider_upload_id) {
    try {
      const { getMuxClient } = await import("@/lib/media/providers/mux/client");
      const mux = getMuxClient();
      const upload = await mux.video.uploads.retrieve(session.provider_upload_id);
      muxAssetId = upload.asset_id ?? null;
    } catch (err) {
      console.error("[reconcile] Failed to fetch Mux upload:", err instanceof Error ? err.message : err);
    }
  }

  if (!muxAssetId) {
    return NextResponse.json({ error: "Mux asset not yet created — upload may still be processing" }, { status: 409 });
  }

  // Fetch Mux asset
  const providerAsset = await muxAdapter.getAsset(muxAssetId);
  if (!providerAsset) return NextResponse.json({ error: "Mux asset not found" }, { status: 404 });
  if (!providerAsset.playbackId) return NextResponse.json({ error: "Mux asset has no playback ID yet" }, { status: 409 });

  // Check if media_asset already exists
  const { data: existingAsset } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("provider", "mux")
    .eq("provider_asset_id", muxAssetId)
    .maybeSingle();

  let assetId: string;

  if (existingAsset) {
    assetId = existingAsset.asset_id;
  } else {
    const playbackSource = muxAdapter.buildPlaybackSource(providerAsset.playbackId, providerAsset.mediaClass);

    const { data: newAsset, error: assetError } = await svc
      .from("media_asset")
      .insert({
        asset_type: "original",
        storage_ref: providerAsset.playbackId,
        integrity_hash: providerAsset.integrityHash,
        format: providerAsset.format,
        resolution: providerAsset.resolution,
        duration_ms: providerAsset.durationMs,
        media_class: providerAsset.mediaClass,
        provider: "mux",
        provider_asset_id: muxAssetId,
        intake_id: session.intake_id ?? null,
      })
      .select("asset_id")
      .single();

    if (assetError || !newAsset) {
      return NextResponse.json({ error: `Failed to create media_asset: ${assetError?.message}` }, { status: 500 });
    }

    assetId = newAsset.asset_id;

    // Create delivery_variant
    const { error: variantError } = await svc
      .from("delivery_variant")
      .insert({
        asset_id: assetId,
        delivery_format: "hls",
        endpoint_ref: playbackSource.endpoint,
      });

    if (variantError && variantError.code !== "23505") {
      console.error("[reconcile] delivery_variant insert failed:", variantError.message);
    }
  }

  // Update session
  await svc
    .from("media_upload_session")
    .update({
      phase: "ingested",
      asset_id: assetId,
      provider_asset_id: muxAssetId,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", session_id)
    .neq("phase", "ingested");

  // Link intake
  if (session.intake_id) {
    await svc
      .from("media_intake")
      .update({ asset_id: assetId })
      .eq("intake_id", session.intake_id)
      .is("asset_id", null);
  }

  return NextResponse.json({ reconciled: true, asset_id: assetId, session_id });
}

/**
 * GET /api/authority/media/asset-playback?assetId=…
 *
 * Resolves the playback source for a media_asset using the provider abstraction.
 * Returns provider-neutral playback information for the inspection UI.
 * Read-only — does not mutate any canonical state.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { getProvider } from "@/lib/media/providers";
import type { MediaClass } from "@/lib/media/providers/interface";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await getParticipantId(supabase)) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });

  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider, provider_asset_id, duration_ms, width, height, audio_presence, intake_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  if (!asset.provider) {
    return NextResponse.json({ error: "Asset has no provider — cannot resolve playback" }, { status: 422 });
  }

  if (asset.asset_type !== "video" && asset.asset_type !== "audio") {
    return NextResponse.json({ error: `Unsupported media class for inspection: ${asset.asset_type}` }, { status: 422 });
  }

  // Resolve delivery variant for the HLS endpoint
  const { data: variant } = await svc
    .from("delivery_variant")
    .select("endpoint_ref")
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve title from intake
  const { data: intake } = asset.intake_id
    ? await svc.from("media_intake").select("title, work_type").eq("intake_id", asset.intake_id).maybeSingle()
    : { data: null };

  // Build playback source via provider abstraction
  let provider;
  try {
    provider = getProvider(asset.provider);
  } catch {
    return NextResponse.json({ error: `Unknown provider: ${asset.provider}` }, { status: 422 });
  }

  const mediaClass: MediaClass = asset.asset_type === "audio" ? "audio" : "video";
  const playbackSource = provider.buildPlaybackSource(asset.storage_ref, mediaClass);

  // For Livepeer, the endpoint is a proxy path — resolve the actual HLS URL
  let hlsUrl: string;
  if (asset.provider === "livepeer") {
    // Use the delivery_variant endpoint if available, otherwise the proxy path
    hlsUrl = variant?.endpoint_ref ?? playbackSource.endpoint;
  } else {
    // Mux: use delivery_variant endpoint if available, otherwise build from storage_ref
    hlsUrl = variant?.endpoint_ref ?? playbackSource.endpoint;
  }

  return NextResponse.json({
    asset_id: asset.asset_id,
    provider: asset.provider,
    provider_asset_id: asset.provider_asset_id,
    storage_ref: asset.storage_ref,
    playback_id: playbackSource.playbackId,
    hls_url: hlsUrl,
    media_class: mediaClass,
    duration_ms: asset.duration_ms,
    width: asset.width,
    height: asset.height,
    audio_presence: asset.audio_presence,
    title: intake?.title ?? null,
    work_type: intake?.work_type ?? null,
  });
}

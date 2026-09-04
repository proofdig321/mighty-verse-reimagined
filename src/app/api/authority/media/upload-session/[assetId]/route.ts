import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/authority/validate";
import { livepeer } from "@/lib/livepeer/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const asset = await livepeer.asset.get(assetId);

  if (!asset.asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const phase = asset.asset.status?.phase ?? "unknown";
  const playbackId = phase === "ready" ? (asset.asset.playbackId ?? null) : null;

  // Update the persisted session phase so recovery is possible
  const svc = getServiceClient();
  const livepeerPhase = phase === "ready" ? "ready" : phase === "failed" ? "failed" : "processing";
  await svc
    .from("media_upload_session")
    .update({ phase: livepeerPhase, updated_at: new Date().toISOString() })
    .eq("provider", "livepeer")
    .eq("provider_asset_id", assetId)
    .in("phase", ["created", "uploading", "processing"]);

  return NextResponse.json({ phase, playback_id: playbackId });
}

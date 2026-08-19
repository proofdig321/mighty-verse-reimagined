import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { livepeer } from "@/lib/livepeer/client";

export async function GET(
  _req: Request,
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

  return NextResponse.json({ phase, playback_id: playbackId });
}

import { NextResponse } from "next/server";
import { livepeer } from "@/lib/livepeer/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playbackId: string }> }
) {
  const { playbackId } = await params;

  const response = await livepeer.playback.get(playbackId);

  if (!response.playbackInfo) {
    return NextResponse.json({ error: "Playback info not found" }, { status: 404 });
  }

  return NextResponse.json(response.playbackInfo);
}

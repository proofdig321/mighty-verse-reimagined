import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { generateStoryboardMedia, ingestGeneratedMedia, storyboardCapabilityStatus } from "@/lib/storyboard/generate";
import { persistStoryboardArtifact } from "@/lib/storyboard/persist";
import type { StoryboardOutputType } from "@/lib/storyboard/artifact";

export const maxDuration = 300;

const OUTPUTS = new Set<StoryboardOutputType>(["panel", "still", "variation", "animation", "clip", "gif", "reel"]);

/**
 * POST /api/authority/storyboard/generate
 *
 * Produce a storyboard artifact. Does not create Scenes.
 */
export async function GET() {
  return NextResponse.json({ capability: storyboardCapabilityStatus(), creates_scene: false });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const outputType = (typeof body.output_type === "string" ? body.output_type : "") as StoryboardOutputType;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const stillUrl = typeof body.still_url === "string" ? body.still_url : null;
  const stillUrls = Array.isArray(body.still_urls) ? body.still_urls.filter((value: unknown) => typeof value === "string") : [];
  const panelId = typeof body.panel_id === "string" ? body.panel_id : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Storyboard artifact";

  if (!OUTPUTS.has(outputType)) {
    return NextResponse.json({ status: "unavailable", error: "Unknown storyboard output type.", creates_scene: false }, { status: 400 });
  }

  const assembly = await loadUniverseAssembly(universeId);
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const auth = await validateAuthority(participantId, "authorise-projection", universeId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const generated = await generateStoryboardMedia({
    output_type: outputType,
    prompt: prompt || title,
    still_url: stillUrl,
    still_urls: stillUrls,
    cors_origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  if (!generated.ok) {
    return NextResponse.json({
      status: generated.status,
      error: generated.message,
      output_type: outputType,
      creates_scene: false,
    }, { status: generated.status === "unavailable" ? 409 : 502 });
  }

  try {
    const ingested = await ingestGeneratedMedia({
      file_path: generated.file_path,
      mime: generated.mime,
      passthrough: `storyboard:${universeId}:${outputType}`,
      cors_origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });

    if (!ingested.ok) {
      await unlink(generated.file_path).catch(() => undefined);
      return NextResponse.json({ status: ingested.status, error: ingested.message, creates_scene: false }, { status: 409 });
    }

    const persisted = await persistStoryboardArtifact({
      svc: getServiceClient(),
      universeId,
      participantId,
      outputType,
      panelId,
      title,
      description: prompt || null,
      source: stillUrl ? "sentinel" : "ai",
      muxAssetId: ingested.mux_asset_id,
      playbackId: ingested.playback_id,
      durationMs: ingested.duration_ms ?? generated.duration_ms,
      mediaClass: ingested.media_class,
      format: ingested.format,
      resolution: ingested.resolution,
    });
    await logOperation(auth.authority_id, "register-storyboard-artifact", persisted.asset_id, "media_asset", "accepted");
    return NextResponse.json({
      status: "ready",
      output_type: outputType,
      asset_id: persisted.asset_id,
      still_url: persisted.still_url,
      endpoint_ref: persisted.endpoint_ref,
      creates_scene: false,
      creates_canonical: false,
      binds_projection: false,
    }, { status: 201 });
  } catch (caught) {
    await unlink(generated.file_path).catch(() => undefined);
    const message = caught instanceof Error ? caught.message : "Storyboard generation failed.";
    return NextResponse.json({ status: "failed", error: message, creates_scene: false }, { status: 500 });
  }
}

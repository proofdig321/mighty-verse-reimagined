import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { createDepthJob, processDepthJob } from "@/lib/depth/jobs";
import { getActiveDepthProvider } from "@/lib/depth/registry";
import { depthProviderCapability } from "@/lib/depth/provider";

export const maxDuration = 60; // Reduced: route only submits, does not wait for inference

/**
 * GET /api/authority/depth/generate
 * Returns the active depth provider capability status.
 */
export async function GET() {
  const provider = getActiveDepthProvider();
  const capability = depthProviderCapability(provider);
  return NextResponse.json({ capability, creates_canonical: false });
}

/**
 * POST /api/authority/depth/generate
 *
 * Queue a depth generation job and submit it to the active provider.
 * Returns HTTP 202 Accepted immediately for async providers (Modal VDA).
 * Returns HTTP 201 Created for synchronous providers that complete inline.
 *
 * Body:
 *   source_asset_id  string  — media_asset.asset_id of the source video
 *   playback_id      string  — Mux playback ID for video access
 *   duration_ms      number  — source video duration in milliseconds
 *   target_fps?      number  — depth sampling rate (default: 2.0)
 *   frame_width?     number  — output frame width (default: 640)
 *
 * Does NOT create canonical Scenes, projections, or bindings.
 * Does NOT interact with Sentinel.
 * Creates: depth_generation_job (queued → processing).
 * On completion (via callback): media_asset (depth) + media_asset_depth.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const sourceAssetId = typeof body.source_asset_id === "string" ? body.source_asset_id.trim() : "";
  const playbackId = typeof body.playback_id === "string" ? body.playback_id.trim() : "";
  const durationMs = typeof body.duration_ms === "number" ? body.duration_ms : 0;
  const targetFps = typeof body.target_fps === "number" ? Math.max(0.5, Math.min(5, body.target_fps)) : 2.0;
  const frameWidth = typeof body.frame_width === "number" ? Math.max(128, Math.min(1280, body.frame_width)) : 640;

  if (!sourceAssetId || !playbackId || durationMs <= 0) {
    return NextResponse.json(
      { error: "source_asset_id, playback_id, and duration_ms are required.", creates_canonical: false },
      { status: 400 },
    );
  }

  // Verify the source asset exists
  const svc = getServiceClient();
  const { data: sourceAsset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, media_class")
    .eq("asset_id", sourceAssetId)
    .maybeSingle();

  if (!sourceAsset) {
    return NextResponse.json({ error: "Source media asset not found.", creates_canonical: false }, { status: 404 });
  }

  const provider = getActiveDepthProvider();

  if (!provider.isConfigured()) {
    return NextResponse.json({
      status: "needs_configuration",
      error: `Depth provider "${provider.providerId}" is not configured.`,
      capability: depthProviderCapability(provider),
      creates_canonical: false,
    }, { status: 409 });
  }

  try {
    const job = await createDepthJob({
      sourceAssetId,
      participantId,
      targetFps,
      frameWidth,
      provider,
    });

    const processed = await processDepthJob({
      jobId: job.job_id,
      playbackId,
      durationMs,
      provider,
    });

    // 202 Accepted: async provider submitted, worker will call back
    // 201 Created: sync provider completed inline
    // 409: needs configuration
    // 502: provider failed
    const httpStatus =
      processed.status === "completed" ? 201 :
      processed.status === "processing" ? 202 :
      processed.status === "needs_configuration" ? 409 :
      processed.status === "failed" ? 502 :
      200;

    return NextResponse.json({
      job_id: processed.job_id,
      status: processed.status,
      result: processed.result,
      error: processed.error,
      creates_canonical: false,
      creates_scene: false,
    }, { status: httpStatus });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Depth generation failed.";
    return NextResponse.json({
      status: "failed",
      error: message,
      creates_canonical: false,
      creates_scene: false,
    }, { status: 500 });
  }
}

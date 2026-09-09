import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { loadUniverseReferences } from "@/lib/assemble/load-references";
import { loadUniverseProductionResults } from "@/lib/assemble/load-production";
import { deriveSceneProductionBriefs } from "@/lib/production/plan";
import { decideProductionDispatch, productionPlanId } from "@/lib/production/adapter";
import { runFfmpegProofExecutor } from "@/lib/production/executor";
import { loadCanonicalMuxBlocklist, persistProductionMuxAsset, persistProductionRealization } from "@/lib/production/persist";
import { decideRegisterProductionResult } from "@/lib/production/result";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";

export const maxDuration = 300;

/**
 * POST /api/authority/production/execute
 *
 * Default: not_connected.
 * Explicit proof=true with MV_PRODUCTION_PROOF_EXECUTOR=ffmpeg runs the
 * replaceable ffmpeg proof executor for Powerhouse only, then Mux ingest.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const sceneId = typeof body.scene_master_id === "string" ? body.scene_master_id.trim() : "";

  const assembly = universeId ? await loadUniverseAssembly(universeId) : null;
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const auth = await validateAuthority(participantId, "authorise-projection", universeId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const [intelligence, references, results] = await Promise.all([
    loadSentinelIntelligence(assembly, { includeObservations: false }),
    loadUniverseReferences(universeId),
    loadUniverseProductionResults(universeId),
  ]);
  const briefs = deriveSceneProductionBriefs(assembly, intelligence, references, results);
  const brief = briefs.find((entry) => entry.scene_master_id === sceneId) ?? null;
  const decision = decideProductionDispatch({
    universe_id: universeId,
    brief,
    proof: body.proof === true,
    proof_executor: process.env.MV_PRODUCTION_PROOF_EXECUTOR ?? null,
  });

  if (!decision.ok) {
    const status = decision.code === "not_connected" ? 409 : 400;
    return NextResponse.json({
      error: decision.message,
      code: decision.code,
      creates_canonical: false,
      populates_media_realization: false,
      video_infrastructure: "mux",
    }, { status });
  }

  if (brief?.result) {
    return NextResponse.json({
      already: true,
      asset_id: brief.result.asset_id,
      realization_id: brief.result.realization_id,
      mux_asset_id: brief.result.mux_asset_id,
      playback_id: brief.result.playback_id,
      approval: brief.result.approval,
      attached: brief.result.attached,
      creates_canonical: false,
      binds_projection: false,
      video_infrastructure: "mux",
    });
  }

  const executor = await runFfmpegProofExecutor({ universe_id: universeId, brief: brief! });
  if (!executor.ok) {
    return NextResponse.json({ error: executor.message, code: executor.code }, { status: 500 });
  }

  const passthrough = productionPlanId(universeId, sceneId);
  const corsOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let muxAsset;
  try {
    muxAsset = await muxAdapter.ingestLocalFile({
      filePath: executor.file_path,
      passthrough,
      corsOrigin,
      contentType: executor.mime,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Mux ingest failed.";
    return NextResponse.json({
      error: message,
      code: "mux_ingest_failed",
      executor: executor.executor,
      executor_job_id: executor.job_id,
    }, { status: 502 });
  } finally {
    await unlink(executor.file_path).catch(() => undefined);
  }
  if (!muxAsset?.playbackId) {
    return NextResponse.json({
      error: "Mux playback is not ready. Mighty Verse will not invent a playback ID.",
      code: "mux_ingest_failed",
      executor: executor.executor,
      executor_job_id: executor.job_id,
    }, { status: 502 });
  }

  const svc = getServiceClient();
  const blocklist = await loadCanonicalMuxBlocklist(svc);
  const muralId = assembly.murals[0]?.master_id ?? null;
  const register = decideRegisterProductionResult({
    universe_id: universeId,
    scene_master_id: sceneId,
    mux_asset_id: muxAsset.providerAssetId,
    playback_id: muxAsset.playbackId,
    executor: executor.executor,
    executor_job_id: executor.job_id,
    source_asset_id: brief!.references[0]?.source_asset_id ?? null,
    canonical_start_ms: brief!.start_ms,
    canonical_end_ms: brief!.end_ms,
    plan_id: passthrough,
    mural_id: muralId,
    blocked_mux_asset_ids: blocklist.muxAssetIds,
    blocked_playback_ids: blocklist.playbackIds,
  });
  if (!register.ok) {
    return NextResponse.json({ error: register.message, code: register.code }, { status: 400 });
  }

  try {
    const persisted = await persistProductionMuxAsset({
      svc,
      decision: register,
      participantId,
      sceneTitle: brief!.title,
      durationMs: muxAsset.durationMs ?? executor.duration_ms,
      resolution: muxAsset.resolution,
      mediaClass: muxAsset.mediaClass,
      format: muxAsset.format,
    });
    const realization = await persistProductionRealization({
      svc,
      participantId,
      assetId: persisted.asset_id,
      intakeId: persisted.intake_id ?? "",
      decision: register,
    });
    await logOperation(auth.authority_id, "register-production-result", persisted.asset_id, "media_asset", "accepted");
    return NextResponse.json({
      asset_id: persisted.asset_id,
      realization_id: realization.realization_id,
      mux_asset_id: register.mux_asset_id,
      playback_id: register.playback_id,
      executor: executor.executor,
      executor_job_id: executor.job_id,
      approval: "awaiting",
      attached: false,
      created: persisted.created,
      creates_canonical: false,
      binds_projection: false,
      records_media_realization: true,
      video_infrastructure: "mux",
    }, { status: persisted.created ? 201 : 200 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Failed to register production media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

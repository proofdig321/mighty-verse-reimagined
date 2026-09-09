import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { suiteScenes } from "@/lib/assemble/suite";
import { muxAdapter } from "@/lib/media/providers/mux/adapter";
import { productionPlanId } from "@/lib/production/adapter";
import { loadCanonicalMuxBlocklist, persistProductionMuxAsset, persistProductionRealization } from "@/lib/production/persist";
import { decideRegisterProductionResult } from "@/lib/production/result";

/**
 * POST /api/authority/production/register
 *
 * Register a Mux-ready production result as media_asset + intake provenance
 * and a Scene-scoped media_realization. Mux is queried for authoritative playback.
 * Canonical source Mux assets are rejected. Does not bind canonical projections.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const svc = getServiceClient();
  const blocklist = await loadCanonicalMuxBlocklist(svc);

  const muxAssetId = typeof body.mux_asset_id === "string" ? body.mux_asset_id.trim() : "";
  const playbackHint = typeof body.playback_id === "string" ? body.playback_id.trim() : "";
  if (blocklist.muxAssetIds.includes(muxAssetId) || (playbackHint && blocklist.playbackIds.includes(playbackHint))) {
    return NextResponse.json({
      error: "Canonical Mux source media cannot be registered as a production result.",
      code: "canonical_source",
      creates_canonical: false,
      binds_projection: false,
      populates_media_realization: false,
    }, { status: 400 });
  }

  const preview = decideRegisterProductionResult({
    ...body,
    blocked_mux_asset_ids: blocklist.muxAssetIds,
    blocked_playback_ids: blocklist.playbackIds,
  });
  if (!preview.ok && preview.code !== "missing_playback") {
    return NextResponse.json({ error: preview.message, code: preview.code }, { status: 400 });
  }

  const universeId = typeof body.universe_id === "string" ? body.universe_id.trim() : "";
  const sceneId = typeof body.scene_master_id === "string" ? body.scene_master_id.trim() : "";
  const assembly = universeId ? await loadUniverseAssembly(universeId) : null;
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const scene = suiteScenes(assembly).find((entry) => entry.master_id === sceneId);
  if (!scene) {
    return NextResponse.json({ error: "Scene does not belong to this Universe." }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", universeId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  if (!muxAssetId) {
    return NextResponse.json({ error: "Mux asset is required.", code: "missing_ids" }, { status: 400 });
  }

  const muxAsset = await muxAdapter.getAsset(muxAssetId);
  if (!muxAsset) {
    return NextResponse.json({
      error: "Mux does not know this asset yet. Mighty Verse will not invent a Mux ID.",
      code: "mux_not_found",
    }, { status: 404 });
  }
  if (!muxAsset.playbackId) {
    return NextResponse.json({
      error: "Mux playback is not ready. Mighty Verse will not invent a playback ID.",
      code: "missing_playback",
      processing: true,
    }, { status: 409 });
  }

  const muralId = assembly.murals[0]?.master_id ?? null;
  const decision = decideRegisterProductionResult({
    universe_id: universeId,
    scene_master_id: sceneId,
    mux_asset_id: muxAsset.providerAssetId,
    playback_id: muxAsset.playbackId,
    executor: body.executor,
    executor_job_id: body.executor_job_id,
    source_asset_id: body.source_asset_id,
    canonical_start_ms: scene.start_ms,
    canonical_end_ms: scene.end_ms,
    plan_id: productionPlanId(universeId, sceneId),
    mural_id: muralId,
    blocked_mux_asset_ids: blocklist.muxAssetIds,
    blocked_playback_ids: blocklist.playbackIds,
  });
  if (!decision.ok) {
    const status = decision.code === "missing_playback" ? 409 : 400;
    return NextResponse.json({ error: decision.message, code: decision.code }, { status });
  }

  try {
    const persisted = await persistProductionMuxAsset({
      svc,
      decision,
      participantId,
      sceneTitle: scene.title,
      durationMs: muxAsset.durationMs,
      resolution: muxAsset.resolution,
      mediaClass: muxAsset.mediaClass,
      format: muxAsset.format,
    });
    const realization = await persistProductionRealization({
      svc,
      participantId,
      assetId: persisted.asset_id,
      intakeId: persisted.intake_id ?? "",
      decision,
    });
    await logOperation(auth.authority_id, "register-production-result", persisted.asset_id, "media_asset", "accepted");
    return NextResponse.json({
      asset_id: persisted.asset_id,
      realization_id: realization.realization_id,
      created: persisted.created,
      mux_asset_id: decision.mux_asset_id,
      playback_id: decision.playback_id,
      approval: "awaiting",
      attached: false,
      creates_canonical: false,
      binds_projection: false,
      populates_media_realization: true,
      video_infrastructure: "mux",
    }, { status: persisted.created ? 201 : 200 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Failed to register production media.";
    if (message === "canonical_source") {
      return NextResponse.json({
        error: "Canonical Mux source media cannot be registered as a production result.",
        code: "canonical_source",
      }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

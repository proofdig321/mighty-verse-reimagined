import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { decideSceneTiming } from "@/lib/assemble/scene-timing";
import { decideAuthoriseWindows } from "@/lib/media/sentinel-intelligence";

/**
 * POST /api/authority/sentinel/authorise
 *
 * Authorise Sentinel-proposed windows onto existing Scene bindings.
 * Does not create Scenes, projections, or media.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const universeId = typeof body.universe_id === "string" ? body.universe_id : "";
  const sceneMasterIds = Array.isArray(body.scene_master_ids)
    ? body.scene_master_ids.filter((value: unknown) => typeof value === "string")
    : null;

  const assembly = await loadUniverseAssembly(universeId);
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const intelligence = await loadSentinelIntelligence(assembly);
  if (!intelligence) {
    return NextResponse.json({ error: "No Sentinel evidence is available for this Universe." }, { status: 404 });
  }

  const decision = decideAuthoriseWindows({
    universe_id: universeId,
    proposals: intelligence.proposals,
    scene_master_ids: sceneMasterIds,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message }, { status: 400 });
  }

  const svc = getServiceClient();
  const mural = assembly.murals[0];
  if (!mural) return NextResponse.json({ error: "This Universe has no Mural." }, { status: 404 });

  const applied = [];
  for (const window of decision.windows) {
    const scene = mural.scenes.find((entry) => entry.master_id === window.scene_master_id);
    if (!scene) continue;

    const auth = await validateAuthority(participantId, "authorise-projection", window.scene_master_id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

    const timing = decideSceneTiming({
      universe_id: universeId,
      scene_master_id: window.scene_master_id,
      binding_id: window.binding_id,
      start_ms: window.start_ms,
      end_ms: window.end_ms,
      scene: {
        master_id: window.scene_master_id,
        canonical_type: "scene",
        parent_master_id: mural.master_id,
      },
      mural: {
        master_id: mural.master_id,
        canonical_type: "mural",
        parent_master_id: assembly.master_id,
      },
      binding: {
        binding_id: window.binding_id,
        projection_id: scene.projection_id ?? "",
        master_id: window.scene_master_id,
      },
    });
    if (!timing.ok) {
      return NextResponse.json({ error: timing.message }, { status: 400 });
    }

    const { data, error } = await svc
      .from("projection_media_binding")
      .update({ start_ms: timing.start_ms, end_ms: timing.end_ms })
      .eq("binding_id", timing.binding_id)
      .select("binding_id, start_ms, end_ms")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to authorise Scene window" }, { status: 500 });
    }

    await logOperation(auth.authority_id, "authorise-sentinel-window", timing.scene_master_id, "scene", "accepted");
    applied.push({
      scene_master_id: timing.scene_master_id,
      binding_id: data.binding_id,
      start_ms: data.start_ms,
      end_ms: data.end_ms,
    });
  }

  return NextResponse.json({
    authorised: applied.length,
    windows: applied,
    creates_scene: false,
  });
}

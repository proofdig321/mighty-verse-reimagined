import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient, logOperation } from "@/lib/authority/validate";
import {
  decideAddPresence,
  decideRemovePresence,
  type PresenceMaster,
} from "@/lib/assemble/presence";

type MasterRow = PresenceMaster;

async function loadMaster(svc: ReturnType<typeof getServiceClient>, id: string | null) {
  if (!id) return null;
  const { data } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id")
    .eq("master_id", id)
    .maybeSingle();
  return (data as MasterRow | null) ?? null;
}

async function loadRelation(
  svc: ReturnType<typeof getServiceClient>,
  sceneMasterId: string,
  momentMasterId: string,
) {
  const { data } = await svc
    .from("scene_moment")
    .select("scene_moment_id")
    .eq("scene_master_id", sceneMasterId)
    .eq("moment_master_id", momentMasterId)
    .maybeSingle();
  return data?.scene_moment_id ?? null;
}

function statusFor(code: string) {
  if (code === "missing_ids" || code === "invalid_id" || code === "not_scene" || code === "not_mural" || code === "not_creative_moment") {
    return 400;
  }
  if (code === "not_found" || code === "missing_relation") return 404;
  if (code === "wrong_universe") return 400;
  return 400;
}

async function authorize(participantId: string, sceneMasterId: string) {
  return validateAuthority(participantId, "create-canonical-state", sceneMasterId);
}

// POST /api/authority/scene-moment
// Body: { scene_master_id, moment_master_id, universe_id?, relationship_type?, sort_order? }
// Relates existing objects only. Does not create projections, media, or canonical works.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const scene_master_id = typeof body?.scene_master_id === "string" ? body.scene_master_id.trim() : "";
  const moment_master_id = typeof body?.moment_master_id === "string" ? body.moment_master_id.trim() : "";
  const universe_id = typeof body?.universe_id === "string" ? body.universe_id.trim() : undefined;
  const relationship_type = typeof body?.relationship_type === "string" ? body.relationship_type : "primary";
  const sort_order = typeof body?.sort_order === "number" ? body.sort_order : null;

  const svc = getServiceClient();
  const scene = await loadMaster(svc, scene_master_id || null);
  const mural = await loadMaster(svc, scene?.parent_master_id ?? null);
  const moment = await loadMaster(svc, moment_master_id || null);
  const existingId = scene_master_id && moment_master_id
    ? await loadRelation(svc, scene_master_id, moment_master_id)
    : null;

  const decision = decideAddPresence({
    scene_master_id,
    moment_master_id,
    scene,
    mural,
    moment,
    universe_id,
    alreadyRelated: Boolean(existingId),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message, code: decision.code }, { status: statusFor(decision.code) });
  }

  const auth = await authorize(participantId, decision.scene_master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  if (decision.action === "already_related") {
    return NextResponse.json({
      scene_moment_id: existingId,
      already: true,
      creates_projection: false,
      creates_media: false,
    });
  }

  const { data, error } = await svc
    .from("scene_moment")
    .upsert(
      {
        scene_master_id: decision.scene_master_id,
        moment_master_id: decision.moment_master_id,
        relationship_type,
        sort_order: sort_order ?? null,
        created_by: participantId,
      },
      { onConflict: "scene_master_id,moment_master_id" },
    )
    .select("scene_moment_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logOperation(auth.authority_id, "relate-scene-moment", data.scene_moment_id, "scene-moment", "accepted");
  return NextResponse.json({
    scene_moment_id: data.scene_moment_id,
    already: false,
    creates_projection: false,
    creates_media: false,
  }, { status: 201 });
}

// DELETE /api/authority/scene-moment?scene_master_id=...&moment_master_id=...&universe_id=...
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const scene_master_id = searchParams.get("scene_master_id")?.trim() ?? "";
  const moment_master_id = searchParams.get("moment_master_id")?.trim() ?? "";
  const universe_id = searchParams.get("universe_id")?.trim() || undefined;

  const svc = getServiceClient();
  const scene = await loadMaster(svc, scene_master_id || null);
  const mural = await loadMaster(svc, scene?.parent_master_id ?? null);
  const moment = await loadMaster(svc, moment_master_id || null);
  const existingId = scene_master_id && moment_master_id
    ? await loadRelation(svc, scene_master_id, moment_master_id)
    : null;

  const decision = decideRemovePresence({
    scene_master_id,
    moment_master_id,
    scene,
    mural,
    moment,
    universe_id,
    alreadyRelated: Boolean(existingId),
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message, code: decision.code }, { status: statusFor(decision.code) });
  }

  const auth = await authorize(participantId, decision.scene_master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const { error } = await svc
    .from("scene_moment")
    .delete()
    .eq("scene_master_id", decision.scene_master_id)
    .eq("moment_master_id", decision.moment_master_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (existingId) {
    await logOperation(auth.authority_id, "unrelate-scene-moment", existingId, "scene-moment", "accepted");
  }
  return NextResponse.json({ deleted: true, deletes_objects: false });
}

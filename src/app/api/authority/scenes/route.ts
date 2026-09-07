import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { registerMaster, createCanonicalState, createProjection } from "@/lib/authority/operations";
import { validateAuthority, logOperation, getServiceClient } from "@/lib/authority/validate";

// POST /api/authority/scenes
// Body: { mural_master_id, title, start_ms, end_ms, asset_id }
// Creates: master(scene) → canonical_state → projection → projection_media_binding
// This is an explicit operator action — never called automatically.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { mural_master_id, title, start_ms, end_ms, asset_id } = await request.json();

  if (!mural_master_id) return NextResponse.json({ error: "mural_master_id required" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (typeof start_ms !== "number" || typeof end_ms !== "number") {
    return NextResponse.json({ error: "start_ms and end_ms required as numbers" }, { status: 400 });
  }
  if (end_ms <= start_ms) {
    return NextResponse.json({ error: "end_ms must be greater than start_ms" }, { status: 400 });
  }
  if (!asset_id) return NextResponse.json({ error: "asset_id required" }, { status: 400 });

  const svc = getServiceClient();

  // Verify mural exists and is canonical_type=mural
  const { data: mural } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", mural_master_id)
    .eq("canonical_type", "mural")
    .maybeSingle();
  if (!mural) return NextResponse.json({ error: "Mural not found" }, { status: 404 });

  // Verify asset exists
  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, provider, storage_ref")
    .eq("asset_id", asset_id)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "Media asset not found" }, { status: 404 });

  // Duplicate guard: reject if a scene with the same title already exists under this mural
  // This prevents accidental double-submission. Title is not canonical identity, but
  // duplicate titles under the same mural are unambiguously erroneous.
  const { data: existingScenes } = await svc
    .from("master")
    .select("master_id")
    .eq("parent_master_id", mural_master_id)
    .eq("canonical_type", "scene");
  if (existingScenes?.length) {
    const existingIds = existingScenes.map((s) => s.master_id);
    const { data: existingPres } = await svc
      .from("work_presentation")
      .select("master_id, title")
      .in("master_id", existingIds);
    const duplicate = (existingPres ?? []).find(
      (p) => p.title?.trim().toLowerCase() === title.trim().toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `A scene named "${title.trim()}" already exists under this mural`, master_id: duplicate.master_id },
        { status: 409 }
      );
    }
  }

  // 1. Register master (scene, parent = mural)
  const masterResult = await registerMaster(
    participantId,
    "scene",
    mural_master_id,
    title.trim(),
    undefined
  );
  if ("error" in masterResult) return NextResponse.json({ error: masterResult.error }, { status: 403 });
  const { master_id } = masterResult.data;

  // 2. Create canonical state
  const stateResult = await createCanonicalState(participantId, master_id, null);
  if ("error" in stateResult) return NextResponse.json({ error: stateResult.error }, { status: 500 });
  const { canonical_state_id } = stateResult.data;

  // 3. Create projection
  const projResult = await createProjection(participantId, canonical_state_id, master_id, "experiential");
  if ("error" in projResult) return NextResponse.json({ error: projResult.error }, { status: 500 });
  const { projection_id } = projResult.data;

  // 4. Create projection_media_binding with start/end
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const { data: binding, error: bErr } = await svc
    .from("projection_media_binding")
    .insert({
      projection_id,
      asset_id,
      binding_type: "primary",
      access_level: "public",
      start_ms,
      end_ms,
      created_by: participantId,
      realization_id: null,
    })
    .select("binding_id")
    .single();

  if (bErr || !binding) {
    return NextResponse.json({ error: bErr?.message ?? "Failed to create binding" }, { status: 500 });
  }

  await logOperation(auth.authority_id, "attach-media-binding", binding.binding_id, "media-binding", "accepted");

  return NextResponse.json({
    master_id,
    canonical_state_id,
    projection_id,
    binding_id: binding.binding_id,
  }, { status: 201 });
}

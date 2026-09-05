import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

// POST /api/authority/scene-moment
// Body: { scene_master_id, moment_master_id, relationship_type?, sort_order? }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { scene_master_id, moment_master_id, relationship_type = "primary", sort_order } = await request.json();
  if (!scene_master_id || !moment_master_id) {
    return NextResponse.json({ error: "scene_master_id and moment_master_id required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", scene_master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  const { data, error } = await svc
    .from("scene_moment")
    .upsert(
      { scene_master_id, moment_master_id, relationship_type, sort_order: sort_order ?? null, created_by: participantId },
      { onConflict: "scene_master_id,moment_master_id" }
    )
    .select("scene_moment_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/authority/scene-moment?scene_master_id=...&moment_master_id=...
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const scene_master_id = searchParams.get("scene_master_id");
  const moment_master_id = searchParams.get("moment_master_id");
  if (!scene_master_id || !moment_master_id) {
    return NextResponse.json({ error: "scene_master_id and moment_master_id required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", scene_master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { error } = await svc
    .from("scene_moment")
    .delete()
    .eq("scene_master_id", scene_master_id)
    .eq("moment_master_id", moment_master_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

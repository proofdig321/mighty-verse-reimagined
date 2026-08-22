import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { binding_id, master_id, realization_id } = await request.json();
  if (!binding_id || !master_id || !realization_id) return NextResponse.json({ error: "binding_id, master_id, and realization_id required" }, { status: 400 });
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: binding } = await svc.from("projection_media_binding").select("binding_id, projection!inner(master_id)").eq("binding_id", binding_id).eq("projection.master_id", master_id).maybeSingle();
  if (!binding) return NextResponse.json({ error: "Binding not found for this master" }, { status: 404 });
  const { data: realization } = await svc.from("media_realization").select("realization_id").eq("realization_id", realization_id).eq("master_id", master_id).maybeSingle();
  if (!realization) return NextResponse.json({ error: "Realization not found for this master" }, { status: 404 });

  const { error } = await svc.from("projection_media_binding").update({ realization_id }).eq("binding_id", binding_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ binding_id, realization_id });
}
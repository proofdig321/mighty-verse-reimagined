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

  const { binding_id, master_id, rights_holder_ref, rights_basis } = await request.json();
  if (!binding_id || !master_id || !rights_holder_ref || !rights_basis?.trim()) {
    return NextResponse.json({ error: "binding_id, master_id, rights_holder_ref, and rights_basis are required" }, { status: 400 });
  }
  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: binding } = await svc.from("projection_media_binding").select("binding_id, asset_id, projection!inner(master_id)").eq("binding_id", binding_id).eq("projection.master_id", master_id).maybeSingle();
  if (!binding) return NextResponse.json({ error: "Media binding not found for this work" }, { status: 404 });
  const { data: owner } = await svc.from("participant").select("participant_id").eq("participant_id", rights_holder_ref).eq("status", "active").maybeSingle();
  if (!owner) return NextResponse.json({ error: "Rights owner is not an active registered participant" }, { status: 400 });

  const { error } = await svc.from("media_asset").update({ rights_holder_ref, rights_basis: rights_basis.trim() }).eq("asset_id", binding.asset_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ binding_id, asset_id: binding.asset_id, rights_holder_ref, rights_basis: rights_basis.trim() });
}

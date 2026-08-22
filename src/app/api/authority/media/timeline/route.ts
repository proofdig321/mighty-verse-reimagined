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

  const { binding_id, master_id, start_ms, end_ms } = await request.json();
  if (!binding_id || !master_id || !Number.isInteger(start_ms) || !Number.isInteger(end_ms)) {
    return NextResponse.json({ error: "binding_id, master_id, integer start_ms, and integer end_ms required" }, { status: 400 });
  }
  if (start_ms < 0 || end_ms <= start_ms) {
    return NextResponse.json({ error: "end_ms must be greater than start_ms and start_ms cannot be negative" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_id, projection!inner(master_id)")
    .eq("binding_id", binding_id)
    .eq("projection.master_id", master_id)
    .maybeSingle();
  if (!binding) return NextResponse.json({ error: "Binding not found for this master" }, { status: 404 });

  const { data, error } = await svc
    .from("projection_media_binding")
    .update({ start_ms, end_ms })
    .eq("binding_id", binding_id)
    .select("binding_id, start_ms, end_ms")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to save timeline range" }, { status: 500 });

  return NextResponse.json(data);
}

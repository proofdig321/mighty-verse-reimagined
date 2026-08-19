import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";

// Returns the canonical chain visible to the authenticated authority holder.
// Never returns economic internals, private participant identity, or raw auth UUIDs.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const svc = getServiceClient();

  // Verify authority exists — no data returned if none
  const { data: authority } = await svc
    .from("authority_record")
    .select("authority_id, authority_type, scope_type, capabilities")
    .eq("holder_ref", participantId)
    .eq("revoked", false)
    .maybeSingle();

  if (!authority) return NextResponse.json({ error: "No AuthorityRecord" }, { status: 403 });

  const { data: masters } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, created_at")
    .eq("created_by", participantId)
    .order("created_at", { ascending: false });

  const masterIds = (masters ?? []).map((m) => m.master_id);

  const { data: states } = masterIds.length
    ? await svc
        .from("canonical_state")
        .select("canonical_state_id, master_id, version, authorisation_state, integrity_hash, created_at")
        .in("master_id", masterIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: projections } = masterIds.length
    ? await svc
        .from("projection")
        .select("projection_id, canonical_state_id, master_id, projection_type, collectible_designated, integrity_hash, created_at")
        .in("master_id", masterIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const projectionIds = (projections ?? []).map((p) => p.projection_id);

  const { data: bindings } = projectionIds.length
    ? await svc
        .from("projection_media_binding")
        .select("binding_id, projection_id, binding_type, access_level, asset_id")
        .in("projection_id", projectionIds)
    : { data: [] };

  return NextResponse.json({
    authority: {
      authority_id: authority.authority_id,
      authority_type: authority.authority_type,
      scope_type: authority.scope_type,
      capabilities: authority.capabilities,
    },
    masters: masters ?? [],
    states: states ?? [],
    projections: projections ?? [],
    bindings: bindings ?? [],
  });
}

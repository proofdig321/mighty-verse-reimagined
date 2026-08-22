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
  const { data: authorities } = await svc
    .from("authority_record")
    .select("authority_id, authority_type, scope_type, scope_subject_id, capabilities")
    .eq("holder_ref", participantId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  if (!authorities || authorities.length === 0) return NextResponse.json({ error: "No AuthorityRecord" }, { status: 403 });

  const platformAuthority = authorities.find((record) => record.scope_type === "platform") ?? null;
  const masterAuthorities = authorities.filter((record) => record.scope_type === "master");
  const visibleMasterIds = masterAuthorities
    .map((record) => record.scope_subject_id)
    .filter(Boolean) as string[];

  let masterQuery = svc.from("master").select("master_id, canonical_type, current_state_id, created_at");
  if (!platformAuthority) {
    if (visibleMasterIds.length === 0) {
      return NextResponse.json({
        authority: {
          authority_id: authorities[0].authority_id,
          authority_type: authorities[0].authority_type,
          scope_type: authorities[0].scope_type,
          capabilities: authorities[0].capabilities,
        },
        masters: [],
        states: [],
        projections: [],
        bindings: [],
        presentations: [],
        projectionPresentations: [],
      });
    }
    masterQuery = masterQuery.in("master_id", visibleMasterIds);
  }

  const { data: masters } = await masterQuery.order("created_at", { ascending: false });

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

  const [{ data: bindings }, { data: presentations }, { data: projectionPresentations }] = await Promise.all([
    projectionIds.length
      ? svc
          .from("projection_media_binding")
          .select("binding_id, projection_id, binding_type, access_level, asset_id, start_ms, end_ms, media_asset(storage_ref)")
          .in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    masterIds.length
      ? svc
          .from("work_presentation")
          .select("master_id, title, description, artwork_asset_id")
          .in("master_id", masterIds)
      : Promise.resolve({ data: [] }),
    projectionIds.length
      ? svc
          .from("projection_presentation")
          .select("projection_id, title, description, artwork_asset_id")
          .in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const primaryAuthority = authorities[0];

  return NextResponse.json({
    authority: {
      authority_id: primaryAuthority.authority_id,
      authority_type: primaryAuthority.authority_type,
      scope_type: primaryAuthority.scope_type,
      capabilities: primaryAuthority.capabilities,
    },
    masters: masters ?? [],
    states: states ?? [],
    projections: projections ?? [],
    bindings: bindings ?? [],
    presentations: presentations ?? [],
    projectionPresentations: projectionPresentations ?? [],
  });
}

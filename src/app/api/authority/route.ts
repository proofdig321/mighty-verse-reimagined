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

  let masterQuery = svc.from("master").select("master_id, canonical_type, parent_master_id, current_state_id, created_at");
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
        realizations: [],
        participants: [],
        mediaAssets: [],
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

  const [{ data: bindings }, { data: presentations }, { data: projectionPresentations }, { data: realizations }, { data: participants }, { data: mediaAssets }, { data: mediaIntake }] = await Promise.all([
    projectionIds.length
      ? svc
          .from("projection_media_binding")
          .select("binding_id, projection_id, binding_type, access_level, asset_id, start_ms, end_ms, realization_id, media_asset(storage_ref, asset_type, rights_holder_ref, rights_basis, provider)")
          .in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    masterIds.length
      ? svc
          .from("work_presentation")
          .select("master_id, title, description, artwork_asset_id, artwork_asset(storage_ref)")
          .in("master_id", masterIds)
      : Promise.resolve({ data: [] }),
    projectionIds.length
      ? svc
          .from("projection_presentation")
          .select("projection_id, title, description, artwork_asset_id, artwork_asset(storage_ref)")
          .in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    masterIds.length
      ? svc
          .from("media_realization")
          .select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes")
          .in("master_id", masterIds)
      : Promise.resolve({ data: [] }),
    svc.from("participant").select("participant_id, identity_link(identity_ref, active)").eq("status", "active"),
    svc.from("media_asset").select("asset_id, asset_type, storage_ref, format, duration_ms, created_at"),
    svc.from("media_intake").select("*").order("created_at", { ascending: false }),
  ]);

  const { data: mediaIntakeCredits } = mediaIntake?.length
    ? await svc.from("media_intake_credit").select("intake_id, participant_id, role, display_order").in("intake_id", mediaIntake.map((item) => item.intake_id)).order("display_order")
    : { data: [] };

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
    realizations: realizations ?? [],
    participants: (participants ?? []).map((participant) => ({
      participant_id: participant.participant_id,
      label: Array.isArray(participant.identity_link)
        ? participant.identity_link.find((link: { active: boolean; identity_ref: string }) => link.active)?.identity_ref ?? participant.participant_id.slice(0, 8)
        : participant.participant_id.slice(0, 8),
    })),
    mediaIntakes: (mediaIntake ?? []).map((intake) => ({ ...intake, credits: (mediaIntakeCredits ?? []).filter((credit) => credit.intake_id === intake.intake_id) })),
    mediaIntakeCredits: mediaIntakeCredits ?? [],
    mediaAssets: (mediaAssets ?? []).map((asset) => {
      const intake = (mediaIntake ?? []).find((item) => item.asset_id === asset.asset_id);
      return { ...asset, title: intake?.title ?? null, master_id: intake?.master_id ?? null };
    }),
  });
}

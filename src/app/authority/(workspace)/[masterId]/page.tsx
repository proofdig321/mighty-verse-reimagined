import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import AuthorityWorkClient from "./authority-work-client";

export default async function AuthorityWorkPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const svc = getServiceClient();

  // Verify authority
  const { data: authorities } = await svc
    .from("authority_record")
    .select("authority_id, authority_type, scope_type, scope_subject_id, capabilities")
    .eq("holder_ref", participantId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  if (!authorities || authorities.length === 0) redirect("/auth/sign-in");

  const platformAuthority = authorities.find((a) => a.scope_type === "platform") ?? null;
  const masterAuthorities = authorities.filter((a) => a.scope_type === "master");
  const visibleMasterIds = masterAuthorities.map((a) => a.scope_subject_id).filter(Boolean) as string[];

  // Verify this masterId is within authority scope
  if (!platformAuthority && !visibleMasterIds.includes(masterId)) notFound();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, current_state_id, created_at")
    .eq("master_id", masterId)
    .single();

  if (!master) notFound();

  const [{ data: states }, { data: projections }] = await Promise.all([
    svc.from("canonical_state").select("canonical_state_id, master_id, version, authorisation_state, integrity_hash, created_at").eq("master_id", masterId).order("created_at", { ascending: false }),
    svc.from("projection").select("projection_id, canonical_state_id, master_id, projection_type, collectible_designated, integrity_hash, created_at").eq("master_id", masterId).order("created_at", { ascending: false }),
  ]);

  const projectionIds = (projections ?? []).map((p) => p.projection_id);

  const [{ data: bindings }, { data: presentations }, { data: projectionPresentations }, { data: realizations }, { data: participants }] = await Promise.all([
    projectionIds.length
      ? svc.from("projection_media_binding").select("binding_id, projection_id, binding_type, access_level, asset_id, start_ms, end_ms, realization_id, media_asset(storage_ref, asset_type, rights_holder_ref, rights_basis)").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    svc.from("work_presentation").select("master_id, title, description, artwork_asset_id, artwork_asset(storage_ref)").eq("master_id", masterId).maybeSingle(),
    projectionIds.length
      ? svc.from("projection_presentation").select("projection_id, title, description, artwork_asset_id, artwork_asset(storage_ref)").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    svc.from("media_realization").select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes").eq("master_id", masterId),
    svc.from("participant").select("participant_id, identity_link(identity_ref, active)").eq("status", "active"),
  ]);

  const authority = {
    authority_id: authorities[0].authority_id,
    authority_type: authorities[0].authority_type,
    scope_type: authorities[0].scope_type,
    capabilities: authorities[0].capabilities,
  };

  const participantList = (participants ?? []).map((p) => ({
    participant_id: p.participant_id,
    label: Array.isArray(p.identity_link)
      ? p.identity_link.find((l: { active: boolean; identity_ref: string }) => l.active)?.identity_ref ?? p.participant_id.slice(0, 8)
      : p.participant_id.slice(0, 8),
  }));

  return (
    <AuthorityWorkClient
      authority={authority}
      master={master}
      states={states ?? []}
      projections={projections ?? []}
      bindings={(bindings ?? []) as never}
      presentation={presentations ?? null}
      projectionPresentations={(projectionPresentations ?? []) as never}
      realizations={realizations ?? []}
      participants={participantList}
    />
  );
}

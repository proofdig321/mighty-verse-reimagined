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
  const { data: authoritiesRaw } = await svc
    .from("authority_record")
    .select("authority_id, authority_type, scope_type, scope_subject_id, capabilities")
    .eq("holder_ref", participantId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  const authorities = authoritiesRaw;
  if (!authorities || authorities.length === 0) redirect("/auth/sign-in");
  const auths = authorities!;

  const platformAuthority = auths.find((a) => a.scope_type === "platform") ?? null;
  const masterAuthorities = auths.filter((a) => a.scope_type === "master");
  const visibleMasterIds = masterAuthorities.map((a) => a.scope_subject_id).filter(Boolean) as string[];

  if (!platformAuthority && !visibleMasterIds.includes(masterId)) notFound();

  const { data: masterRaw } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id, current_state_id, created_at")
    .eq("master_id", masterId)
    .single();

  const master = masterRaw;
  if (!master) notFound();
  const m = master!;

  const [{ data: states }, { data: projections }] = await Promise.all([
    svc.from("canonical_state").select("canonical_state_id, master_id, version, authorisation_state, integrity_hash, created_at").eq("master_id", masterId).order("created_at", { ascending: false }),
    svc.from("projection").select("projection_id, canonical_state_id, master_id, projection_type, collectible_designated, integrity_hash, created_at").eq("master_id", masterId).order("created_at", { ascending: false }),
  ]);

  const projectionIds = (projections ?? []).map((p) => p.projection_id);

  const [{ data: bindings }, { data: presentationRow }, { data: projectionPresentationRows }, { data: realizations }, { data: participants }] = await Promise.all([
    projectionIds.length
      ? svc.from("projection_media_binding").select("binding_id, projection_id, binding_type, access_level, asset_id, start_ms, end_ms, realization_id, media_asset(storage_ref, asset_type, rights_holder_ref, rights_basis, provider)").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    svc.from("work_presentation").select("master_id, title, description, artwork_asset_id").eq("master_id", masterId).maybeSingle(),
    projectionIds.length
      ? svc.from("projection_presentation").select("projection_id, title, description, artwork_asset_id").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    svc.from("media_realization").select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes").eq("master_id", masterId),
    svc.from("participant").select("participant_id, identity_link(identity_ref, active)").eq("status", "active"),
  ]);

  const artworkIds = [
    presentationRow?.artwork_asset_id,
    ...(projectionPresentationRows ?? []).map((row) => row.artwork_asset_id),
  ].filter((id): id is string => Boolean(id));
  const { data: artworkAssets } = artworkIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", artworkIds)
    : { data: [] };
  const artworkById = new Map((artworkAssets ?? []).map((asset) => [asset.asset_id, { storage_ref: asset.storage_ref }]));
  const presentations = presentationRow
    ? { ...presentationRow, artwork_asset: presentationRow.artwork_asset_id ? artworkById.get(presentationRow.artwork_asset_id) ?? null : null }
    : null;
  const projectionPresentations = (projectionPresentationRows ?? []).map((row) => ({
    ...row,
    artwork_asset: row.artwork_asset_id ? artworkById.get(row.artwork_asset_id) ?? null : null,
  }));

  // B5: parent context
  let parentTitle: string | null = null;
  let parentCanonicalType: string | null = null;
  if (m.parent_master_id) {
    const [{ data: parentPres }, { data: parentMaster }] = await Promise.all([
      svc.from("work_presentation").select("title").eq("master_id", m.parent_master_id).maybeSingle(),
      svc.from("master").select("canonical_type").eq("master_id", m.parent_master_id).maybeSingle(),
    ]);
    parentTitle = parentPres?.title ?? null;
    parentCanonicalType = parentMaster?.canonical_type ?? null;
  }

  // B5: children (murals for universe, scenes for mural)
  let childItems: { master_id: string; title: string | null; canonical_type: string }[] = [];
  const childType = m.canonical_type === "universe" ? "mural" : m.canonical_type === "mural" ? "scene" : null;
  if (childType) {
    const { data: childMasters } = await svc
      .from("master")
      .select("master_id, canonical_type")
      .eq("parent_master_id", masterId)
      .eq("canonical_type", childType)
      .order("created_at", { ascending: true });
    if (childMasters?.length) {
      const childIds = childMasters.map((c) => c.master_id);
      const { data: childPres } = await svc
        .from("work_presentation")
        .select("master_id, title")
        .in("master_id", childIds);
      childItems = childMasters.map((c) => ({
        master_id: c.master_id,
        canonical_type: c.canonical_type,
        title: (childPres ?? []).find((p) => p.master_id === c.master_id)?.title ?? null,
      }));
    }
  }

  // Rights holder label: resolve from the binding's media_asset.rights_holder_ref
  let rightsHolderLabel: string | null = null;
  const firstBinding = (bindings ?? [])[0] as unknown as { media_asset: { rights_holder_ref: string | null } | null } | undefined;
  const rightsHolderRef = firstBinding?.media_asset?.rights_holder_ref ?? null;
  if (rightsHolderRef) {
    const { data: rhParticipant } = await svc
      .from("participant")
      .select("participant_id, identity_link(identity_ref, active)")
      .eq("participant_id", rightsHolderRef)
      .maybeSingle();
    if (rhParticipant) {
      rightsHolderLabel = Array.isArray(rhParticipant.identity_link)
        ? (rhParticipant.identity_link as { active: boolean; identity_ref: string }[]).find((l) => l.active)?.identity_ref ?? null
        : null;
    }
  }

  // Load the most recent intake for this master (for deterministic upload linkage)
  const { data: masterIntake } = await svc
    .from("media_intake")
    .select("intake_id")
    .eq("master_id", masterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const intakeId = masterIntake?.intake_id ?? null;

  const { data: uploadSessionRows } = await svc
    .from("media_upload_session")
    .select("session_id, phase, provider, asset_id, created_at, updated_at")
    .eq("master_id", masterId)
    .order("created_at", { ascending: false })
    .limit(5);

  const authority = {
    authority_id: auths[0].authority_id,
    authority_type: auths[0].authority_type,
    scope_type: auths[0].scope_type,
    capabilities: auths[0].capabilities,
  };

  const participantList = (participants ?? []).map((p) => {
    const links = Array.isArray(p.identity_link)
      ? (p.identity_link as { active: boolean; identity_ref: string }[])
      : [];
    const activeRef = links.find((l) => l.active)?.identity_ref ?? null;
    const label = activeRef && !activeRef.startsWith("seed:") && !/^[0-9a-f-]{36}$/i.test(activeRef)
      ? activeRef
      : activeRef?.startsWith("seed:")
      ? activeRef.slice("seed:".length).replace(/-v\d+$/, "").replace(/-/g, " ")
      : p.participant_id.slice(0, 8);
    return { participant_id: p.participant_id, label };
  });

  return (
    <AuthorityWorkClient
      authority={authority}
      master={m as never}
      states={states ?? []}
      projections={projections ?? []}
      bindings={(bindings ?? []) as never}
      presentation={(presentations ?? null) as never}
      projectionPresentations={(projectionPresentations ?? []) as never}
      realizations={realizations ?? []}
      participants={participantList}
      parentTitle={parentTitle}
      parentMasterId={m.parent_master_id}
      parentCanonicalType={parentCanonicalType}
      childItems={childItems}
      rightsHolderLabel={rightsHolderLabel}
      intakeId={intakeId}
      uploadSessions={uploadSessionRows ?? []}
    />
  );
}

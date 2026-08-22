import { validateAuthority, logOperation, computeHash, getServiceClient } from "./validate";

export type OperationResult<T> = { data: T } | { error: string };

// ---------------------------------------------------------------------------
// 1. Register a Master — canonical identity only, no attribution entries
//
// Attribution is a separate explicit act (addAttribution below).
// The system must never infer a creative role from the registering participant.
// ---------------------------------------------------------------------------
export async function registerMaster(
  participantId: string,
  canonicalType: "universe" | "creative-moment" | "mural" | "scene" | "interpretation" | "other",
  parentMasterId?: string,
  title?: string,
  description?: string
): Promise<OperationResult<{ master_id: string; attribution_id: string }>> {
  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  const insertPayload: Record<string, unknown> = { canonical_type: canonicalType, created_by: participantId };
  if (parentMasterId) {
    if (canonicalType === "mural") {
      const { data: parentMaster } = await supabase
        .from("master")
        .select("canonical_type")
        .eq("master_id", parentMasterId)
        .single();
      if (!parentMaster) return { error: `Parent master not found: ${parentMasterId}` };
      if (parentMaster.canonical_type !== "universe") {
        return { error: `A Mural parent must be a universe (got: ${parentMaster.canonical_type})` };
      }
    }
    if (canonicalType === "scene") {
      const { data: parentMaster } = await supabase
        .from("master")
        .select("canonical_type")
        .eq("master_id", parentMasterId)
        .single();
      if (!parentMaster) return { error: `Parent master not found: ${parentMasterId}` };
      if (parentMaster.canonical_type !== "mural") {
        return { error: `A Scene parent must be a mural (got: ${parentMaster.canonical_type})` };
      }
    }
    insertPayload.parent_master_id = parentMasterId;
  }

  const { data: master, error: mErr } = await supabase
    .from("master")
    .insert(insertPayload)
    .select("master_id")
    .single();
  if (mErr || !master) return { error: `Failed to create master: ${mErr?.message}` };

  const { data: attr, error: aErr } = await supabase
    .from("attribution_record")
    .insert({ master_id: master.master_id, version: 1 })
    .select("attribution_id")
    .single();
  if (aErr || !attr) return { error: `Failed to create attribution_record: ${aErr?.message}` };

  await supabase
    .from("master")
    .update({ attribution_ref: attr.attribution_id })
    .eq("master_id", master.master_id);

  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    await supabase
      .from("work_presentation")
      .upsert(
        {
          master_id: master.master_id,
          title: trimmedTitle,
          description: description?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "master_id" }
      );
  }

  await logOperation(auth.authority_id, "register-master", master.master_id, "master", "accepted");

  return { data: { master_id: master.master_id, attribution_id: attr.attribution_id } };
}

// ---------------------------------------------------------------------------
// 2. Add Attribution — explicit creative role on an existing master
//
// Every attribution entry is an explicit canonical fact, not a default.
// ---------------------------------------------------------------------------
export async function addAttribution(
  participantId: string,
  masterId: string,
  roleType: "original-artist" | "director" | "collaborator" | "featured-artist" | "interpretation-creator" | "other",
  contributionDescription: string,
  isPublic = true
): Promise<OperationResult<{ entry_id: string }>> {
  const auth = await validateAuthority(participantId, "create-canonical-state", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  const { data: master } = await supabase
    .from("master")
    .select("attribution_ref")
    .eq("master_id", masterId)
    .single();
  if (!master?.attribution_ref) return { error: `No attribution record found for master: ${masterId}` };

  const { data: entry, error: eErr } = await supabase
    .from("attribution_entry")
    .insert({
      attribution_id: master.attribution_ref,
      participant_id: participantId,
      role_type: roleType,
      contribution_description: contributionDescription,
      public: isPublic,
      privacy_level: "public-attribution",
    })
    .select("entry_id")
    .single();
  if (eErr || !entry) return { error: `Failed to create attribution_entry: ${eErr?.message}` };

  await logOperation(auth.authority_id, "add-attribution", masterId, "master", "accepted");

  return { data: { entry_id: entry.entry_id } };
}

// ---------------------------------------------------------------------------
// 2. Create / advance CanonicalState
// ---------------------------------------------------------------------------
export async function createCanonicalState(
  participantId: string,
  masterId: string,
  contentRefs: Record<string, unknown> | null
): Promise<OperationResult<{ canonical_state_id: string; provenance_id: string }>> {
  const auth = await validateAuthority(participantId, "create-canonical-state", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  // Step 5: parent_state_id must match master.current_state_id
  const { data: master } = await supabase
    .from("master")
    .select("current_state_id, attribution_ref")
    .eq("master_id", masterId)
    .single();
  if (!master) return { error: "Master not found" };

  const parentStateId = master.current_state_id ?? null;
  const { data: parentVersion } = parentStateId
    ? await supabase
        .from("canonical_state")
        .select("version")
        .eq("canonical_state_id", parentStateId)
        .single()
    : { data: null };

  const version = parentVersion ? parentVersion.version + 1 : 1;

  const hash = await computeHash({
    authorisation_state: "authorised",
    authorised_by: auth.authority_id,
    master_id: masterId,
    parent_state_id: parentStateId,
    version,
  });

  const { data: cs, error: csErr } = await supabase
    .from("canonical_state")
    .insert({
      master_id: masterId,
      version,
      parent_state_id: parentStateId,
      authorised_by: auth.authority_id,
      authorisation_state: "authorised",
      attribution_snapshot_ref: master.attribution_ref,
      content_refs: contentRefs ?? null,
      integrity_hash: hash,
    })
    .select("canonical_state_id")
    .single();
  if (csErr || !cs) return { error: `Failed to create canonical_state: ${csErr?.message}` };

  // Provenance record (public per I.1.A)
  const provHash = await computeHash({
    authorised_by: auth.authority_id,
    relationship_type: parentStateId ? "canonical-revision" : "canonical-revision",
    source_id: parentStateId,
    source_type: parentStateId ? "canonical-state" : null,
    subject_id: cs.canonical_state_id,
    subject_type: "canonical-state",
  });

  const { data: prov, error: pErr } = await supabase
    .from("provenance_record")
    .insert({
      subject_id: cs.canonical_state_id,
      subject_type: "canonical-state",
      source_id: parentStateId,
      source_type: parentStateId ? "canonical-state" : null,
      relationship_type: "canonical-revision",
      authorised_by: auth.authority_id,
      public: true,
      integrity_hash: provHash,
    })
    .select("provenance_id")
    .single();
  if (pErr || !prov) return { error: `Failed to create provenance_record: ${pErr?.message}` };

  // Wire provenance_ref and advance master.current_state_id (advance-master-state)
  const advAuth = await validateAuthority(participantId, "advance-master-state", masterId);
  if ("error" in advAuth) return { error: advAuth.error };

  await supabase
    .from("canonical_state")
    .update({ provenance_ref: prov.provenance_id })
    .eq("canonical_state_id", cs.canonical_state_id);

  await supabase
    .from("master")
    .update({ current_state_id: cs.canonical_state_id })
    .eq("master_id", masterId);

  await logOperation(auth.authority_id, "create-canonical-state", cs.canonical_state_id, "canonical-state", "accepted");
  await logOperation(advAuth.authority_id, "advance-master-state", masterId, "master", "accepted");

  return { data: { canonical_state_id: cs.canonical_state_id, provenance_id: prov.provenance_id } };
}

// ---------------------------------------------------------------------------
// 3. Create / authorise a Projection
// ---------------------------------------------------------------------------
export async function createProjection(
  participantId: string,
  canonicalStateId: string,
  masterId: string,
  projectionType: "experiential" | "distributional" | "archival" | "collectible-designated" | "other"
): Promise<OperationResult<{ projection_id: string; provenance_id: string }>> {
  const auth = await validateAuthority(participantId, "authorise-projection", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  const hash = await computeHash({
    canonical_state_id: canonicalStateId,
    collectible_designated: false,
    created_by: auth.authority_id,
    master_id: masterId,
    projection_type: projectionType,
  });

  const { data: proj, error: pErr } = await supabase
    .from("projection")
    .insert({
      canonical_state_id: canonicalStateId,
      master_id: masterId,
      projection_type: projectionType,
      collectible_designated: false,
      created_by: auth.authority_id,
      integrity_hash: hash,
    })
    .select("projection_id")
    .single();
  if (pErr || !proj) return { error: `Failed to create projection: ${pErr?.message}` };

  const provHash = await computeHash({
    authorised_by: auth.authority_id,
    relationship_type: "projection",
    source_id: canonicalStateId,
    source_type: "canonical-state",
    subject_id: proj.projection_id,
    subject_type: "projection",
  });

  const { data: prov, error: provErr } = await supabase
    .from("provenance_record")
    .insert({
      subject_id: proj.projection_id,
      subject_type: "projection",
      source_id: canonicalStateId,
      source_type: "canonical-state",
      relationship_type: "projection",
      authorised_by: auth.authority_id,
      public: true,
      integrity_hash: provHash,
    })
    .select("provenance_id")
    .single();
  if (provErr || !prov) return { error: `Failed to create provenance_record: ${provErr?.message}` };

  await supabase
    .from("projection")
    .update({ provenance_ref: prov.provenance_id })
    .eq("projection_id", proj.projection_id);

  await logOperation(auth.authority_id, "authorise-projection", proj.projection_id, "projection", "accepted");

  return { data: { projection_id: proj.projection_id, provenance_id: prov.provenance_id } };
}

// ---------------------------------------------------------------------------
// 4. Attach / verify ProjectionMediaBinding (Livepeer asset ingest)
// ---------------------------------------------------------------------------
export async function attachMediaBinding(
  participantId: string,
  projectionId: string,
  masterId: string,
  livepeerAssetId: string,
  rightsHolderRef?: string | null,
  rightsBasis?: string | null,
  realizationId?: string | null
): Promise<OperationResult<{ binding_id: string; asset_id: string; variant_id: string }>> {
  const auth = await validateAuthority(participantId, "authorise-projection", masterId);
  if ("error" in auth) return { error: auth.error };

  // Delegate to existing ingestLivepeerAsset — it handles media_asset + delivery_variant + binding
  const { ingestLivepeerAsset } = await import("@/lib/media/ingest");
  const result = await ingestLivepeerAsset(
    livepeerAssetId,
    projectionId,
    participantId,
    "primary",
    "public",
    rightsHolderRef,
    rightsBasis ?? "rights recorded during ingest",
    realizationId ?? null
  );

  await logOperation(auth.authority_id, "attach-media-binding", result.binding_id, "media-binding", "accepted");

  return { data: result };
}

export async function createMediaRealization(
  participantId: string,
  masterId: string,
  realizationType: "original-recording" | "animated-video" | "live-performance" | "broadcast-recording" | "music-video" | "visualisation" | "other",
  rightsHolderRef: string | null,
  rightsBasis: string | null,
  productionNotes?: string | null
): Promise<OperationResult<{ realization_id: string }>> {
  const auth = await validateAuthority(participantId, "create-canonical-state", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("media_realization")
    .insert({
      master_id: masterId,
      realization_type: realizationType,
      rights_holder_ref: rightsHolderRef,
      rights_basis: rightsBasis,
      production_notes: productionNotes ?? null,
      created_by: participantId,
    })
    .select("realization_id")
    .single();

  if (error || !data) {
    return { error: `Failed to create media_realization: ${error?.message ?? "unknown error"}` };
  }

  await logOperation(auth.authority_id, "create-media-realization", data.realization_id, "media-realization", "accepted");

  return { data: { realization_id: data.realization_id } };
}

export async function grantAuthority(
  participantId: string,
  targetParticipantId: string,
  scopeType: "platform" | "master",
  scopeSubjectId: string | null,
  capabilities: AuthorityCapability[],
  authorityType: "delegated" = "delegated",
  authorisationEvidence?: string
): Promise<OperationResult<{ authority_id: string }>> {
  if (scopeType === "platform" && scopeSubjectId) {
    return { error: "Platform-scoped authority cannot also set a scope subject." };
  }
  if (scopeType === "master" && !scopeSubjectId) {
    return { error: "Master-scoped authority requires a scope_subject_id." };
  }
  if (capabilities.length === 0) {
    return { error: "At least one capability is required." };
  }

  const validCapabilities: AuthorityCapability[] = [
    "create-canonical-state",
    "advance-master-state",
    "authorise-projection",
    "designate-collectible",
    "authorise-interpretation",
    "delegate-authority",
    "revoke-delegation",
  ];
  const unsupportedCapability = capabilities.find((cap) => !validCapabilities.includes(cap));
  if (unsupportedCapability) return { error: `Unsupported authority capability: ${unsupportedCapability}` };

  const supabase = getServiceClient();
  const { data: targetParticipant } = await supabase
    .from("participant")
    .select("participant_id")
    .eq("participant_id", targetParticipantId)
    .eq("status", "active")
    .maybeSingle();
  if (!targetParticipant) return { error: "Target participant is not active or does not exist." };

  if (scopeType === "master") {
    const { data: targetMaster } = await supabase
      .from("master")
      .select("master_id")
      .eq("master_id", scopeSubjectId)
      .maybeSingle();
    if (!targetMaster) return { error: "Scope master does not exist." };
  }

  const grantAuth = await validateAuthority(participantId, "delegate-authority", scopeType === "master" ? scopeSubjectId : null);
  if ("error" in grantAuth) return { error: grantAuth.error };

  const { data: grantorRecord, error: grantorError } = await supabase
    .from("authority_record")
    .select("authority_id, capabilities")
    .eq("authority_id", grantAuth.authority_id)
    .single();

  if (grantorError || !grantorRecord) {
    return { error: "Unable to resolve granting authority record." };
  }

  const grantorCapabilities = (grantorRecord.capabilities ?? []) as AuthorityCapability[];
  const invalidCapability = capabilities.find((cap) => !grantorCapabilities.includes(cap));
  if (invalidCapability) {
    return { error: `Cannot grant capability ${invalidCapability} without holding it yourself.` };
  }

  const { data: authority, error: authorityError } = await supabase
    .from("authority_record")
    .insert({
      holder_ref: targetParticipantId,
      authority_type: authorityType,
      scope_type: scopeType,
      scope_subject_id: scopeType === "master" ? scopeSubjectId : null,
      capabilities,
      delegated_from: grantAuth.authority_id,
      effective_from: new Date().toISOString(),
      revoked: false,
      authorisation_evidence: authorisationEvidence ?? null,
      created_by: participantId,
    })
    .select("authority_id")
    .single();

  if (authorityError || !authority) {
    return { error: `Failed to grant authority: ${authorityError?.message ?? "unknown error"}` };
  }

  await logOperation(grantAuth.authority_id, "grant-authority", authority.authority_id, "authority-record", "accepted");

  return { data: { authority_id: authority.authority_id } };
}

// ---------------------------------------------------------------------------
// 5. Designate a Collectible
//
// Rights-safety invariant (Build 10, 2026-08-21):
//   Unknown rights (rights_holder_ref = null) are a rights-risk state and block
//   collectible designation. This is a minimum safety floor — it does not
//   automatically authorise third-party-owned assets for collectible use.
//   Establishing rights_holder_ref is necessary but not sufficient for collectible
//   eligibility; usage authorisation is a separate determination.
// ---------------------------------------------------------------------------
export async function designateCollectible(
  participantId: string,
  projectionId: string,
  masterId: string
): Promise<OperationResult<{ projection_id: string }>> {
  const auth = await validateAuthority(participantId, "designate-collectible", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  // Rights-safety check: all bound media assets must have a known rights_holder_ref
  const { data: bindings } = await supabase
    .from("projection_media_binding")
    .select("asset_id, media_asset(rights_holder_ref)")
    .eq("projection_id", projectionId);

  for (const b of bindings ?? []) {
    const asset = (b.media_asset as unknown) as { rights_holder_ref: string | null } | null;
    if (!asset?.rights_holder_ref) {
      return { error: `Collectible designation blocked: media asset ${b.asset_id} has unknown rights holder. Establish rights before designating as collectible.` };
    }
  }

  const { error } = await supabase
    .from("projection")
    .update({ collectible_designated: true })
    .eq("projection_id", projectionId);
  if (error) return { error: `Failed to designate collectible: ${error.message}` };

  await logOperation(auth.authority_id, "designate-collectible", projectionId, "projection", "accepted");

  return { data: { projection_id: projectionId } };
}

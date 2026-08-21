import { validateAuthority, logOperation, computeHash, getServiceClient } from "./validate";

export type OperationResult<T> = { data: T } | { error: string };

// ---------------------------------------------------------------------------
// 1. Register a Master
// ---------------------------------------------------------------------------
export async function registerMaster(
  participantId: string,
  canonicalType: "song-world" | "creative-moment" | "mural" | "interpretation" | "other",
  parentMasterId?: string
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
      if (parentMaster.canonical_type !== "song-world") {
        return { error: `A Mural parent must be a song-world (got: ${parentMaster.canonical_type})` };
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

  // canonical-creator entry (public per I.1.B)
  await supabase.from("attribution_entry").insert({
    attribution_id: attr.attribution_id,
    participant_id: participantId,
    role_type: "original-artist",
    public: true,
    privacy_level: "public-attribution",
  });

  // director entry (public per I.1.C)
  await supabase.from("attribution_entry").insert({
    attribution_id: attr.attribution_id,
    participant_id: participantId,
    role_type: "director",
    public: true,
    privacy_level: "public-attribution",
  });

  await supabase
    .from("master")
    .update({ attribution_ref: attr.attribution_id })
    .eq("master_id", master.master_id);

  await logOperation(auth.authority_id, "register-master", master.master_id, "master", "accepted");

  return { data: { master_id: master.master_id, attribution_id: attr.attribution_id } };
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
  livepeerAssetId: string
): Promise<OperationResult<{ binding_id: string; asset_id: string; variant_id: string }>> {
  const auth = await validateAuthority(participantId, "authorise-projection", masterId);
  if ("error" in auth) return { error: auth.error };

  // Delegate to existing ingestLivepeerAsset — it handles media_asset + delivery_variant + binding
  const { ingestLivepeerAsset } = await import("@/lib/media/ingest");
  const result = await ingestLivepeerAsset(livepeerAssetId, projectionId, participantId, "primary", "public");

  await logOperation(auth.authority_id, "attach-media-binding", result.binding_id, "media-binding", "accepted");

  return { data: result };
}

// ---------------------------------------------------------------------------
// 5. Designate a Collectible
// ---------------------------------------------------------------------------
export async function designateCollectible(
  participantId: string,
  projectionId: string,
  masterId: string
): Promise<OperationResult<{ projection_id: string }>> {
  const auth = await validateAuthority(participantId, "designate-collectible", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("projection")
    .update({ collectible_designated: true })
    .eq("projection_id", projectionId);
  if (error) return { error: `Failed to designate collectible: ${error.message}` };

  await logOperation(auth.authority_id, "designate-collectible", projectionId, "projection", "accepted");

  return { data: { projection_id: projectionId } };
}

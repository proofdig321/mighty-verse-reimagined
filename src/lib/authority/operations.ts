import { validateAuthority, logOperation, computeHash, getServiceClient } from "./validate";
import type { AuthorityCapability } from "./validate";
import { isProtectedMaster } from "@/lib/assemble/protected-work";
import { decideWithdraw } from "@/lib/assemble/withdraw";
import {
  classifyUniverseOccupancy,
  hasSourceMediaFromSession,
} from "@/lib/assemble/occupancy";
import {
  decideDiscardIntake,
  decideDiscardMedia,
  markDiscardedStorageRef,
  mediaHasLiveCanonicalBinding,
} from "@/lib/media/discard-asset";
import { associateAssetWithCanonicalWork } from "@/lib/assemble/studio";

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
  if ((canonicalType === "creative-moment" || canonicalType === "mural" || canonicalType === "scene") && !parentMasterId) {
    return { error: `A ${canonicalType} requires a parent master.` };
  }
  if (parentMasterId) {
    if (canonicalType === "mural" || canonicalType === "creative-moment") {
      const { data: parentMaster } = await supabase
        .from("master")
        .select("canonical_type")
        .eq("master_id", parentMasterId)
        .single();
      if (!parentMaster) return { error: `Parent master not found: ${parentMasterId}` };
      if (canonicalType === "mural" && parentMaster.canonical_type !== "universe") {
        return { error: `A Mural parent must be a universe (got: ${parentMaster.canonical_type})` };
      }
      if (canonicalType === "creative-moment" && parentMaster.canonical_type !== "universe") {
        return { error: `A Creative Moment parent must be a universe (got: ${parentMaster.canonical_type})` };
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

export async function createMediaRealization(
  participantId: string,
  masterId: string,
  realizationType: "original-recording" | "animated-video" | "live-performance" | "broadcast-recording" | "music-video" | "visualisation" | "other",
  rightsHolderRef: string | null,
  rightsBasis: string | null,
  productionNotes?: string | null,
  sourceRealizationId?: string | null
): Promise<OperationResult<{ realization_id: string }>> {
  const auth = await validateAuthority(participantId, "create-canonical-state", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();

  // Validate source_realization_id if provided
  if (sourceRealizationId) {
    // Verify source realization exists
    const { data: sourceReal } = await supabase
      .from("media_realization")
      .select("realization_id")
      .eq("realization_id", sourceRealizationId)
      .maybeSingle();
    if (!sourceReal) {
      return { error: `Source realization not found: ${sourceRealizationId}` };
    }
    // Cycle detection: walk the source chain to ensure no cycle would be created.
    // A new realization R with source S would create a cycle if S is already
    // reachable from R — but since R doesn't exist yet, we check that S's
    // ancestry chain does not already contain a realization that would loop.
    // Since R is new, the only cycle risk is if sourceRealizationId eventually
    // points back to itself (which the DB CHECK prevents for direct self-reference).
    // For multi-hop cycles (A→B→C→A), we walk the chain from sourceRealizationId
    // up to a reasonable depth.
    const cycleCheck = await detectRealizationCycle(supabase, sourceRealizationId, 20);
    if (cycleCheck) {
      return { error: `Source realization chain contains a cycle: ${cycleCheck}` };
    }
  }

  const { data, error } = await supabase
    .from("media_realization")
    .insert({
      master_id: masterId,
      realization_type: realizationType,
      rights_holder_ref: rightsHolderRef,
      rights_basis: rightsBasis,
      production_notes: productionNotes ?? null,
      created_by: participantId,
      source_realization_id: sourceRealizationId ?? null,
    })
    .select("realization_id")
    .single();

  if (error || !data) {
    return { error: `Failed to create media_realization: ${error?.message ?? "unknown error"}` };
  }

  await logOperation(auth.authority_id, "create-media-realization", data.realization_id, "media-realization", "accepted");

  return { data: { realization_id: data.realization_id } };
}

/**
 * Walk the source_realization_id chain from a given realization.
 * Returns a description of the cycle if one is detected, null if clean.
 * Limits traversal to maxDepth to prevent runaway queries.
 */
async function detectRealizationCycle(
  supabase: ReturnType<typeof getServiceClient>,
  startId: string,
  maxDepth: number
): Promise<string | null> {
  const visited = new Set<string>();
  let currentId: string | null = startId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    if (visited.has(currentId)) {
      return `cycle detected at realization_id=${currentId}`;
    }
    visited.add(currentId);
    // Use explicit type annotation to avoid Supabase generic inference issue
    const rows = await supabase
      .from("media_realization")
      .select("source_realization_id")
      .eq("realization_id", currentId)
      .limit(1);
    const row = rows.data?.[0] as { source_realization_id: string | null } | undefined;
    currentId = row?.source_realization_id ?? null;
    depth++;
  }
  return null;
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

async function descendantMasterIds(
  supabase: ReturnType<typeof getServiceClient>,
  master: { master_id: string; canonical_type: string },
): Promise<string[]> {
  const ids: string[] = [];
  if (master.canonical_type === "universe") {
    const { data: children } = await supabase
      .from("master")
      .select("master_id, canonical_type")
      .eq("parent_master_id", master.master_id);
    for (const child of children ?? []) {
      ids.push(child.master_id);
      if (child.canonical_type === "mural") {
        const { data: scenes } = await supabase
          .from("master")
          .select("master_id")
          .eq("parent_master_id", child.master_id)
          .eq("canonical_type", "scene");
        for (const scene of scenes ?? []) ids.push(scene.master_id);
      }
    }
  } else if (master.canonical_type === "mural") {
    const { data: scenes } = await supabase
      .from("master")
      .select("master_id")
      .eq("parent_master_id", master.master_id)
      .eq("canonical_type", "scene");
    for (const scene of scenes ?? []) ids.push(scene.master_id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// 6. Withdraw a Master — Authority act, not a CMS delete
//
// Clears current_state_id so Discover listings that already require an
// authorised current state stop presenting the work. Rows, projections,
// bindings, and provenance remain. Super Hero Ego cannot be withdrawn.
// ---------------------------------------------------------------------------
export async function withdrawMaster(
  participantId: string,
  masterId: string,
): Promise<OperationResult<{ master_ids: string[]; already: boolean }>> {
  const preview = decideWithdraw({ masterId, currentStateId: undefined });
  if (!preview.ok) return { error: preview.message };

  const auth = await validateAuthority(participantId, "advance-master-state", masterId);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();
  const { data: master } = await supabase
    .from("master")
    .select("master_id, canonical_type, current_state_id")
    .eq("master_id", masterId)
    .maybeSingle();
  if (!master) return { error: "Master not found" };
  if (isProtectedMaster(master.master_id)) {
    return { error: "Super Hero Ego is curated canonical work. It cannot be withdrawn." };
  }

  const decided = decideWithdraw({
    masterId: master.master_id,
    currentStateId: master.current_state_id,
  });
  if (!decided.ok) return { error: decided.message };

  const descendants = await descendantMasterIds(supabase, master);
  const subjectIds = [master.master_id, ...descendants].filter((id) => !isProtectedMaster(id));

  if (decided.action === "already_withdrawn") {
    await logOperation(auth.authority_id, "withdraw-master", master.master_id, "master", "accepted");
    return { data: { master_ids: subjectIds, already: true } };
  }

  const { error } = await supabase
    .from("master")
    .update({ current_state_id: null })
    .in("master_id", subjectIds);
  if (error) return { error: `Failed to withdraw master: ${error.message}` };

  await logOperation(auth.authority_id, "withdraw-master", master.master_id, "master", "accepted");
  return { data: { master_ids: subjectIds, already: false } };
}

async function assetHasLiveCanonicalBinding(
  supabase: ReturnType<typeof getServiceClient>,
  assetId: string,
): Promise<boolean> {
  const { data: bindings } = await supabase
    .from("projection_media_binding")
    .select("asset_id, projection_id")
    .eq("asset_id", assetId);
  if (!bindings?.length) return false;

  const projIds = [...new Set(bindings.map((row) => row.projection_id))];
  const { data: projections } = await supabase
    .from("projection")
    .select("projection_id, master_id")
    .in("projection_id", projIds);
  const boundMasterIds = [...new Set((projections ?? []).map((row) => row.master_id))];
  const { data: boundMasters } = boundMasterIds.length
    ? await supabase
        .from("master")
        .select("master_id, canonical_type, parent_master_id, current_state_id")
        .in("master_id", boundMasterIds)
    : { data: [] };

  const parentIds = [
    ...new Set((boundMasters ?? []).map((row) => row.parent_master_id).filter(Boolean) as string[]),
  ];
  const { data: parentMasters } = parentIds.length
    ? await supabase
        .from("master")
        .select("master_id, canonical_type, parent_master_id, current_state_id")
        .in("master_id", parentIds)
    : { data: [] };

  const grandparentIds = [
    ...new Set((parentMasters ?? []).map((row) => row.parent_master_id).filter(Boolean) as string[]),
  ];
  const { data: grandparentMasters } = grandparentIds.length
    ? await supabase
        .from("master")
        .select("master_id, canonical_type, parent_master_id, current_state_id")
        .in("master_id", grandparentIds)
    : { data: [] };

  const allMasters = [...(boundMasters ?? []), ...(parentMasters ?? []), ...(grandparentMasters ?? [])];
  const uniqueMasters = [...new Map(allMasters.map((row) => [row.master_id, row])).values()];
  const titleIds = uniqueMasters.map((row) => row.master_id);
  const { data: presentations } = titleIds.length
    ? await supabase.from("work_presentation").select("master_id, title").in("master_id", titleIds)
    : { data: [] };

  const association = associateAssetWithCanonicalWork({
    assetId,
    bindings,
    projections: projections ?? [],
    masters: uniqueMasters,
    presentations: presentations ?? [],
  });
  if (!association.universe_id) return false;

  const universe = uniqueMasters.find((row) => row.master_id === association.universe_id);
  const { data: session } = await supabase
    .from("media_upload_session")
    .select("phase, asset_id, updated_at")
    .eq("master_id", association.universe_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const occupancy = classifyUniverseOccupancy({
    title: association.universe_title,
    currentStateId: universe?.current_state_id ?? null,
    muralHasPlayableMedia: Boolean(association.mural_id),
    hasSourceMedia: Boolean(association.mural_id) || hasSourceMediaFromSession({
      phase: session?.phase,
      assetId: session?.asset_id,
    }),
  });

  return mediaHasLiveCanonicalBinding({
    boundUniverses: [
      {
        title: association.universe_title,
        occupancy,
        protected: isProtectedMaster(association.universe_id),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 7. Discard incoming media — Authority act, not a CMS hard-delete
//
// Prefixes storage_ref so Incoming / Gallery skip the row. Bindings and the
// media_asset row remain. Super Hero Ego and Father Raymond assets stay.
// ---------------------------------------------------------------------------
export async function discardMediaAsset(
  participantId: string,
  assetId: string,
): Promise<OperationResult<{ asset_id: string }>> {
  const preview = decideDiscardMedia({ assetId });
  if (!preview.ok && preview.code === "invalid_asset") return { error: preview.message };

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();
  const { data: asset } = await supabase
    .from("media_asset")
    .select("asset_id, storage_ref")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found" };

  const liveCanonicalBinding = await assetHasLiveCanonicalBinding(supabase, asset.asset_id);
  const decided = decideDiscardMedia({
    assetId: asset.asset_id,
    storageRef: asset.storage_ref,
    liveCanonicalBinding,
  });
  if (!decided.ok) return { error: decided.message };

  const { error } = await supabase
    .from("media_asset")
    .update({ storage_ref: markDiscardedStorageRef(asset.storage_ref) })
    .eq("asset_id", asset.asset_id);
  if (error) return { error: `Failed to remove media: ${error.message}` };

  await logOperation(auth.authority_id, "discard-media-asset", asset.asset_id, "media-asset", "accepted");
  return { data: { asset_id: asset.asset_id } };
}

// ---------------------------------------------------------------------------
// 8. Discard unlinked intake — Authority act, not a CMS hard-delete
//
// Sets search_status to excluded so Gallery awaiting-upload hides the row.
// Linked intakes are refused; delete the media asset instead.
// Super Hero Ego and Father Raymond playback assets stay.
// ---------------------------------------------------------------------------
export async function discardMediaIntake(
  participantId: string,
  intakeId: string,
): Promise<OperationResult<{ intake_id: string }>> {
  const preview = decideDiscardIntake({ intakeId });
  if (!preview.ok && preview.code === "invalid_intake") return { error: preview.message };

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return { error: auth.error };

  const supabase = getServiceClient();
  const { data: intake } = await supabase
    .from("media_intake")
    .select("intake_id, asset_id, search_status")
    .eq("intake_id", intakeId)
    .maybeSingle();
  if (!intake) return { error: "Intake not found" };

  const decided = decideDiscardIntake({
    intakeId: intake.intake_id,
    assetId: intake.asset_id,
    searchStatus: intake.search_status,
  });
  if (!decided.ok) return { error: decided.message };

  const { error } = await supabase
    .from("media_intake")
    .update({ search_status: "excluded", updated_at: new Date().toISOString() })
    .eq("intake_id", intake.intake_id);
  if (error) return { error: `Failed to remove intake: ${error.message}` };

  await logOperation(auth.authority_id, "discard-media-intake", intake.intake_id, "media-intake", "accepted");
  return { data: { intake_id: intake.intake_id } };
}

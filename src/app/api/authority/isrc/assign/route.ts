import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient, logOperation } from "@/lib/authority/validate";
import {
  constructIsrc,
  validateIsrc,
  normalizeIsrc,
  isIsrcEligible,
} from "@/lib/media/isrc";

// POST /api/authority/isrc/assign
// Body: { realization_id, master_id, registrant_id?, notes? }
//
// Lifecycle:
//   1. Auth + participant resolution
//   2. Load realization — verify it exists and belongs to master_id
//   3. Guard: already has ISRC → refuse
//   4. Guard: realization_type not ISRC-eligible → refuse
//   5. Authority gate: caller must hold create-canonical-state on master_id
//   6. Rights gate: realization must have rights_holder_ref
//   7. Load active registrant (supplied or default active)
//   8. Atomic designation allocation via allocate_isrc_designation()
//   9. Construct + validate ISRC
//  10. Persist to media_realization (isrc + isrc_status = 'assigned')
//  11. Write isrc_assignment_log
//  12. Log canonical operation

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json();
  const { realization_id, master_id, registrant_id, notes } = body;

  if (!realization_id || !master_id) {
    return NextResponse.json({ error: "realization_id and master_id required" }, { status: 400 });
  }

  const svc = getServiceClient();

  // 2. Load realization
  const { data: realization } = await svc
    .from("media_realization")
    .select("realization_id, master_id, realization_type, rights_holder_ref, isrc, isrc_status")
    .eq("realization_id", realization_id)
    .eq("master_id", master_id)
    .maybeSingle();

  if (!realization) {
    return NextResponse.json({ error: "Realization not found or does not belong to this master" }, { status: 404 });
  }

  // 3. Guard: already has ISRC
  if (realization.isrc) {
    return NextResponse.json({
      error: "This recording already has an ISRC. Do not generate another.",
      existing_isrc: realization.isrc,
      isrc_status: realization.isrc_status,
    }, { status: 409 });
  }

  // 4. Guard: ISRC eligibility
  if (!isIsrcEligible(realization.realization_type)) {
    return NextResponse.json({
      error: `Realization type '${realization.realization_type}' is not ISRC-eligible. Only sound recordings, music videos, live performances, and broadcast recordings require ISRCs.`,
    }, { status: 422 });
  }

  // 5. Authority gate
  const auth = await validateAuthority(participantId, "create-canonical-state", master_id);
  if ("error" in auth) {
    return NextResponse.json({
      error: "ISRC assignment unavailable. Mighty Verse cannot establish that the current registrant is authorized to assign an ISRC to this recording. Resolve rights/authority information first.",
      detail: auth.error,
    }, { status: 403 });
  }

  // 6. Rights gate: realization must have a known rights holder
  if (!realization.rights_holder_ref) {
    return NextResponse.json({
      error: "ISRC assignment blocked: rights holder not recorded for this realization. Establish rights_holder_ref before assigning an ISRC.",
    }, { status: 422 });
  }

  // 7. Load active registrant
  let registrantQuery = svc
    .from("isrc_registrant")
    .select("registrant_id, registrant_name, prefix_code")
    .eq("active", true);

  if (registrant_id) {
    registrantQuery = registrantQuery.eq("registrant_id", registrant_id) as typeof registrantQuery;
  }

  const { data: registrant } = await registrantQuery.limit(1).maybeSingle();

  if (!registrant) {
    return NextResponse.json({
      error: "No active ISRC registrant configured. Configure the authorized prefix before assigning ISRCs.",
    }, { status: 422 });
  }

  // 8. Atomic designation allocation
  const now = new Date();
  const yearOfReference = now.getFullYear() % 100; // e.g. 2026 → 26

  const { data: designation, error: allocErr } = await svc.rpc("allocate_isrc_designation", {
    p_registrant_id: registrant.registrant_id,
    p_year: yearOfReference,
  });

  if (allocErr || designation == null) {
    return NextResponse.json({
      error: `Failed to allocate ISRC designation: ${allocErr?.message ?? "unknown error"}`,
    }, { status: 500 });
  }

  // 9. Construct + validate
  const isrc = constructIsrc(registrant.prefix_code, yearOfReference, designation as number);
  const validationError = validateIsrc(isrc);
  if (validationError) {
    return NextResponse.json({ error: `Generated ISRC failed validation: ${validationError}` }, { status: 500 });
  }

  // Final duplicate check (belt-and-suspenders after unique constraint)
  const { data: duplicate } = await svc
    .from("media_realization")
    .select("realization_id")
    .eq("isrc", isrc)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json({
      error: `ISRC ${isrc} already exists in the database. This should not happen — contact the system administrator.`,
    }, { status: 409 });
  }

  // 10. Persist to media_realization
  const { error: updateErr } = await svc
    .from("media_realization")
    .update({ isrc, isrc_status: "assigned" })
    .eq("realization_id", realization_id);

  if (updateErr) {
    return NextResponse.json({ error: `Failed to persist ISRC: ${updateErr.message}` }, { status: 500 });
  }

  // 11. Write audit log
  await svc.from("isrc_assignment_log").insert({
    realization_id,
    isrc,
    registrant_id: registrant.registrant_id,
    prefix_code: registrant.prefix_code,
    year_of_reference: yearOfReference,
    designation: designation as number,
    assignment_status: "assigned",
    assigned_by: participantId,
    notes: notes ?? null,
  });

  // 12. Canonical operation log
  await logOperation(auth.authority_id, "assign-isrc", realization_id, "media-realization", "accepted");

  // 13. Trigger sidecar sync for all assets linked to this realization
  // Non-fatal — ISRC assignment succeeds regardless of sidecar outcome
  try {
    const { buildCanonicalMetadata } = await import("@/lib/media/metadata-build");
    const { syncSidecar } = await import("@/lib/media/metadata-embed");
    const { data: linkedAssets } = await svc
      .from("media_asset")
      .select("asset_id")
      .eq("realization_id", realization_id);
    // Also find assets via projection_media_binding.realization_id
    const { data: boundAssets } = await svc
      .from("projection_media_binding")
      .select("asset_id")
      .eq("realization_id", realization_id);
    const assetIds = new Set<string>([
      ...(linkedAssets ?? []).map(a => a.asset_id),
      ...(boundAssets ?? []).map(b => b.asset_id),
    ]);
    for (const assetId of assetIds) {
      const meta = await buildCanonicalMetadata(assetId);
      if (meta) await syncSidecar(assetId, meta);
    }
  } catch {
    // Sidecar sync failure does not affect ISRC assignment
  }

  return NextResponse.json({
    realization_id,
    isrc,
    isrc_status: "assigned",
    registrant_name: registrant.registrant_name,
    prefix_code: registrant.prefix_code,
    year_of_reference: yearOfReference,
    designation: designation as number,
    assigned_at: now.toISOString(),
  }, { status: 201 });
}

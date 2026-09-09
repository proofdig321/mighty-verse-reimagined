import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import {
  decideApproveProductionResult,
  decideAttachProductionLayer,
  parseProductionProvenance,
  productionProvenanceNotes,
} from "@/lib/production/result";
import { isProductionIntegrityHash } from "@/lib/production/lifecycle";

/**
 * POST /api/authority/production/approve
 *
 * Human approval of a Mux-delivered production result.
 * Completion is not approval. Attachment to 2.5D requires approved.
 * Does not create projection_media_binding or media_realization.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const assetId = typeof body.asset_id === "string" ? body.asset_id.trim() : "";
  const svc = getServiceClient();

  const { data: asset } = assetId
    ? await svc
        .from("media_asset")
        .select("asset_id, intake_id, integrity_hash, provider")
        .eq("asset_id", assetId)
        .maybeSingle()
    : { data: null };
  if (!asset) return NextResponse.json({ error: "Production media asset was not found." }, { status: 404 });

  const { data: intake } = asset.intake_id
    ? await svc
        .from("media_intake")
        .select("intake_id, master_id, provenance_notes")
        .eq("intake_id", asset.intake_id)
        .maybeSingle()
    : { data: null };
  const provenance = parseProductionProvenance(intake?.provenance_notes ?? null);
  if (!provenance || !isProductionIntegrityHash(asset.integrity_hash)) {
    return NextResponse.json({
      error: "This asset is not a production result.",
      code: "not_production",
    }, { status: 400 });
  }

  const assembly = await loadUniverseAssembly(provenance.universe_id);
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  const auth = await validateAuthority(participantId, "authorise-projection", provenance.universe_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const rejected = body.approval === "rejected";
  const nextApproval = rejected ? "rejected" : "approved";
  const wantAttach = body.attach === true && nextApproval === "approved";

  const decision = decideApproveProductionResult({
    asset_id: asset.asset_id,
    provenance,
    attach: wantAttach,
  });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message, code: decision.code }, { status: 400 });
  }

  let attached = false;
  if (wantAttach) {
    const attach = decideAttachProductionLayer({
      provenance: { ...provenance, approval: nextApproval },
    });
    if (!attach.ok) {
      return NextResponse.json({ error: attach.message, code: attach.code }, { status: 400 });
    }
    attached = true;
  }

  const notes = productionProvenanceNotes(
    {
      ok: true,
      action: "register_production_result",
      universe_id: provenance.universe_id,
      scene_master_id: provenance.scene_master_id,
      mux_asset_id: provenance.mux_asset_id,
      playback_id: provenance.playback_id,
      integrity_hash: asset.integrity_hash ?? "",
      executor: provenance.executor,
      executor_job_id: provenance.executor_job_id,
      source_asset_id: provenance.source_asset_id,
      canonical_start_ms: provenance.canonical_start_ms,
      canonical_end_ms: provenance.canonical_end_ms,
      creates_universe: false,
      creates_mural: false,
      creates_scene: false,
      creates_creative_moment: false,
      creates_projection: false,
      creates_binding: false,
      creates_realization: false,
      binds_projection: false,
      canonicalises: false,
      replaces_canonical_mux: false,
    },
    nextApproval,
    attached,
  );

  const { error: updateError } = await svc
    .from("media_intake")
    .update({ provenance_notes: notes })
    .eq("intake_id", intake!.intake_id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logOperation(
    auth.authority_id,
    attached ? "attach-production-layer" : "approve-production-result",
    asset.asset_id,
    "media_asset",
    "accepted",
  );

  return NextResponse.json({
    asset_id: asset.asset_id,
    approval: nextApproval,
    attached,
    creates_canonical: false,
    binds_canonical_mux: false,
    populates_media_realization: false,
    video_infrastructure: "mux",
  });
}

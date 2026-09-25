import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import {
  decideApproveProductionResult,
  decideAttachProductionLayer,
  parseProductionRealizationNotes,
} from "@/lib/production/result";
import { isProductionIntegrityHash } from "@/lib/production/lifecycle";
import { updateProductionRealizationNotes } from "@/lib/production/persist";

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
        .select("asset_id, intake_id, integrity_hash, provider, realization_id")
        .eq("asset_id", assetId)
        .maybeSingle()
    : { data: null };
  if (!asset) return NextResponse.json({ error: "Production media asset was not found." }, { status: 404 });

  if (!isProductionIntegrityHash(asset.integrity_hash)) {
    return NextResponse.json({
      error: "This asset is not a production result.",
      code: "not_production",
    }, { status: 400 });
  }

  // Read lifecycle state from media_realization.production_notes (authoritative).
  // media_intake.provenance_notes records intake origin only and is not updated on approve.
  const realizationId = asset.realization_id;
  const { data: realization } = realizationId
    ? await svc
        .from("media_realization")
        .select("realization_id, production_notes")
        .eq("realization_id", realizationId)
        .maybeSingle()
    : { data: null };

  const provenance = parseProductionRealizationNotes(realization?.production_notes ?? null);
  if (!provenance) {
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

  // Update media_realization.production_notes only — single authoritative lifecycle state.
  // media_intake.provenance_notes is intake origin and is not mutated after registration.
  if (realizationId) {
    await updateProductionRealizationNotes({
      svc,
      realizationId,
      approval: nextApproval,
      attached,
    });
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
    realization_id: realizationId ?? null,
    approval: nextApproval,
    attached,
    creates_canonical: false,
    binds_canonical_mux: false,
    populates_media_realization: Boolean(realizationId),
    video_infrastructure: "mux",
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient, logOperation, validateAuthority } from "@/lib/authority/validate";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { suiteScenes } from "@/lib/assemble/suite";
import { formatTimelineMs } from "@/lib/media/timing";
import { isInspectableAssetType } from "@/lib/media/inspect-persist";
import { CURATED_REFERENCE_PROVIDER } from "@/lib/production/lifecycle";
import { decideRetainReference, referenceProvenanceNotes } from "@/lib/production/reference";

/**
 * POST /api/authority/references
 *
 * Retain a Sentinel still as a curated production reference.
 * Does not create canonical objects, bindings, or realizations.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const decision = decideRetainReference(body);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message }, { status: 400 });
  }

  const assembly = await loadUniverseAssembly(decision.universe_id);
  if (!assembly) return NextResponse.json({ error: "Universe was not found." }, { status: 404 });

  if (decision.scene_master_id) {
    const scene = suiteScenes(assembly).find((entry) => entry.master_id === decision.scene_master_id);
    if (!scene) {
      return NextResponse.json({ error: "Scene does not belong to this Universe." }, { status: 400 });
    }
  }

  const auth = await validateAuthority(participantId, "authorise-projection", decision.universe_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();
  const { data: source } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider")
    .eq("asset_id", decision.source_asset_id)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Source media asset was not found." }, { status: 404 });
  if (!isInspectableAssetType(source.asset_type)) {
    return NextResponse.json({ error: "Only source media can be retained as a production reference." }, { status: 400 });
  }

  const { data: existing } = await svc
    .from("media_asset")
    .select("asset_id")
    .eq("integrity_hash", decision.integrity_hash)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      asset_id: existing.asset_id,
      created: false,
      already: true,
      creates_scene: false,
      creates_canonical: false,
      binds_projection: false,
    });
  }

  const sceneTitle =
    suiteScenes(assembly).find((entry) => entry.master_id === decision.scene_master_id)?.title ??
    assembly.title ??
    "Reference";

  const { data: asset, error: assetError } = await svc
    .from("media_asset")
    .insert({
      asset_type: "thumbnail",
      storage_ref: source.storage_ref,
      integrity_hash: decision.integrity_hash,
      format: decision.role,
      duration_ms: decision.time_ms,
      media_class: "image",
      provider: CURATED_REFERENCE_PROVIDER,
      provider_asset_id: decision.source_asset_id,
    })
    .select("asset_id")
    .single();

  if (assetError || !asset) {
    if (assetError?.code === "23505") {
      const { data: raced } = await svc
        .from("media_asset")
        .select("asset_id")
        .eq("integrity_hash", decision.integrity_hash)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({
          asset_id: raced.asset_id,
          created: false,
          already: true,
          creates_scene: false,
          creates_canonical: false,
          binds_projection: false,
        });
      }
    }
    return NextResponse.json({ error: assetError?.message ?? "Failed to retain reference." }, { status: 500 });
  }

  const { data: intake, error: intakeError } = await svc
    .from("media_intake")
    .insert({
      master_id: decision.universe_id,
      asset_id: asset.asset_id,
      title: `${sceneTitle} ${decision.role} · ${formatTimelineMs(decision.time_ms)}`,
      work_type: "other",
      source_type: "other",
      source_provider: source.provider,
      supplied_by: participantId,
      isrc_status: "not-applicable",
      provenance_notes: referenceProvenanceNotes(decision),
    })
    .select("intake_id")
    .single();

  if (intakeError || !intake) {
    return NextResponse.json({ error: intakeError?.message ?? "Failed to record reference provenance." }, { status: 500 });
  }

  await svc.from("media_asset").update({ intake_id: intake.intake_id }).eq("asset_id", asset.asset_id);
  await logOperation(auth.authority_id, "retain-curated-reference", asset.asset_id, "media_asset", "accepted");

  return NextResponse.json({
    asset_id: asset.asset_id,
    created: true,
    already: false,
    creates_scene: false,
    creates_canonical: false,
    binds_projection: false,
  }, { status: 201 });
}

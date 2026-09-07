import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, logOperation, getServiceClient } from "@/lib/authority/validate";

/**
 * POST /api/authority/media
 *
 * Creates a projection_media_binding linking a canonical projection to a media asset.
 *
 * For Mux: the media_asset already exists (created by the webhook handler).
 * This route creates only the projection_media_binding.
 *
 * For Livepeer (historical): delegates to the existing ingestLivepeerAsset path.
 *
 * Authority: requires authorise-projection capability on the master.
 * The webhook cannot call this route — canonical binding is an authority operation.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const {
    projection_id,
    master_id,
    session_id,
    // Direct asset binding — for already-ingested assets (e.g. Mux)
    asset_id,
    // Optional timing override — if omitted, existing binding timings are preserved
    start_ms,
    end_ms,
    // Legacy Livepeer field — kept for backward compatibility
    livepeer_asset_id,
    rights_holder_ref,
    rights_basis,
    realization_id,
    intake_id,
  } = await request.json();

  if (!projection_id || !master_id) {
    return NextResponse.json({ error: "projection_id and master_id required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "authorise-projection", master_id);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // ── Direct asset_id path: bind an already-ingested asset (e.g. Mux) ──────
  if (asset_id && !session_id && !livepeer_asset_id) {
    const { data: existingAsset } = await svc
      .from("media_asset")
      .select("asset_id")
      .eq("asset_id", asset_id)
      .maybeSingle();
    if (!existingAsset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Validate caller-supplied timings if provided
    const hasStart = start_ms !== undefined && start_ms !== null;
    const hasEnd = end_ms !== undefined && end_ms !== null;
    if ((hasStart || hasEnd) && !(hasStart && hasEnd)) {
      return NextResponse.json({ error: "Both start_ms and end_ms must be provided together" }, { status: 400 });
    }
    if (hasStart && hasEnd && end_ms <= start_ms) {
      return NextResponse.json({ error: "end_ms must be greater than start_ms" }, { status: 400 });
    }

    // Read existing binding to preserve timings and realization_id
    const { data: existingBinding } = await svc
      .from("projection_media_binding")
      .select("start_ms, end_ms, realization_id, access_level")
      .eq("projection_id", projection_id)
      .eq("binding_type", "primary")
      .maybeSingle();

    const preservedStartMs = hasStart ? start_ms : (existingBinding?.start_ms ?? null);
    const preservedEndMs = hasEnd ? end_ms : (existingBinding?.end_ms ?? null);
    const preservedRealizationId = realization_id ?? existingBinding?.realization_id ?? null;
    const preservedAccessLevel = existingBinding?.access_level ?? "public";

    // Delete existing primary binding then insert replacement
    // NOTE: these two operations are not atomic. If the insert fails, the projection
    // will temporarily have no primary binding. A future migration to upsert-by-unique
    // constraint on (projection_id, binding_type='primary') would eliminate this window.
    await svc
      .from("projection_media_binding")
      .delete()
      .eq("projection_id", projection_id)
      .eq("binding_type", "primary");

    const { data: binding, error: bErr } = await svc
      .from("projection_media_binding")
      .insert({
        projection_id,
        asset_id,
        binding_type: "primary",
        access_level: preservedAccessLevel,
        created_by: participantId,
        realization_id: preservedRealizationId,
        start_ms: preservedStartMs,
        end_ms: preservedEndMs,
      })
      .select("binding_id")
      .single();
    if (bErr || !binding) {
      return NextResponse.json({ error: bErr?.message ?? "Failed to create binding" }, { status: 500 });
    }
    await logOperation(auth.authority_id, "attach-media-binding", binding.binding_id, "media-binding", "accepted");
    return NextResponse.json({ binding_id: binding.binding_id, asset_id }, { status: 201 });
  }

  // ── Mux path: asset was created by webhook; find it via session ──────────
  if (session_id && !livepeer_asset_id) {
    const { data: session } = await svc
      .from("media_upload_session")
      .select("session_id, phase, asset_id, provider")
      .eq("session_id", session_id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
    }
    if (session.phase !== "ingested" || !session.asset_id) {
      return NextResponse.json({
        error: `Media not ready. Session phase: ${session.phase}. Wait for processing to complete.`,
      }, { status: 409 });
    }

    // Update rights on the asset if provided
    if (rights_holder_ref) {
      await svc
        .from("media_asset")
        .update({
          rights_holder_ref,
          rights_basis: rights_basis ?? "rights recorded during ingest",
        })
        .eq("asset_id", session.asset_id)
        .is("rights_holder_ref", null);
    }

    // Update intake linkage if provided
    if (intake_id) {
      await svc
        .from("media_asset")
        .update({ intake_id })
        .eq("asset_id", session.asset_id)
        .is("intake_id", null);
    }

    // Idempotency: check if binding already exists
    const { data: existingBinding } = await svc
      .from("projection_media_binding")
      .select("binding_id, asset_id")
      .eq("projection_id", projection_id)
      .eq("asset_id", session.asset_id)
      .maybeSingle();

    if (existingBinding) {
      return NextResponse.json({
        binding_id: existingBinding.binding_id,
        asset_id: existingBinding.asset_id,
        variant_id: null,
      }, { status: 200 });
    }

    const { data: binding, error: bindingError } = await svc
      .from("projection_media_binding")
      .insert({
        projection_id,
        asset_id: session.asset_id,
        binding_type: "primary",
        access_level: "public",
        created_by: participantId,
        realization_id: realization_id ?? null,
      })
      .select("binding_id")
      .single();

    if (bindingError || !binding) {
      return NextResponse.json({ error: `Failed to create binding: ${bindingError?.message}` }, { status: 500 });
    }

    const { data: variant } = await svc
      .from("delivery_variant")
      .select("variant_id")
      .eq("asset_id", session.asset_id)
      .maybeSingle();

    await logOperation(auth.authority_id, "attach-media-binding", binding.binding_id, "media-binding", "accepted");

    return NextResponse.json({
      binding_id: binding.binding_id,
      asset_id: session.asset_id,
      variant_id: variant?.variant_id ?? null,
    }, { status: 201 });
  }

  // ── Livepeer path: historical ingest via livepeer_asset_id ───────────────
  if (livepeer_asset_id) {
    const { attachMediaBinding } = await import("@/lib/authority/operations");
    const result = await attachMediaBinding(
      participantId,
      projection_id,
      master_id,
      livepeer_asset_id,
      rights_holder_ref ?? null,
      rights_basis ?? null,
      realization_id ?? null,
      intake_id ?? null
    );

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });

    // Mark session as ingested if session_id provided
    if (session_id) {
      await svc
        .from("media_upload_session")
        .update({ phase: "ingested", asset_id: result.data.asset_id, updated_at: new Date().toISOString() })
        .eq("session_id", session_id);
    }

    return NextResponse.json(result.data, { status: 201 });
  }

  return NextResponse.json({ error: "session_id, asset_id, or livepeer_asset_id required" }, { status: 400 });
}

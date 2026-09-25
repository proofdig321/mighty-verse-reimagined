import { createClient } from "@supabase/supabase-js";

// Service-role client — never exposed to the browser
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type BindingType = "primary" | "variant" | "thumbnail" | "preview" | "downloadable";
type AccessLevel = "public" | "authenticated" | "owner-only" | "collector-only";

type IngestResult = {
  asset_id: string;
  variant_id: string;
  binding_id: string;
};

/**
 * Bind an already-ingested Mux asset (identified by asset_id) to a projection.
 * The media_asset and delivery_variant must already exist (created by the Mux webhook).
 * This function only creates the projection_media_binding.
 */
export async function bindMuxAsset(
  assetId: string,
  projectionId: string,
  participantId: string,
  bindingType: BindingType = "primary",
  accessLevel: AccessLevel = "public",
  rightsHolderRef?: string | null,
  rightsBasis?: string | null,
  realizationId?: string | null,
  intakeId?: string | null
): Promise<IngestResult> {
  const supabase = getServiceClient();

  const { data: existingAsset } = await supabase
    .from("media_asset")
    .select("asset_id, rights_holder_ref")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!existingAsset) {
    throw new Error(`Media asset not found: ${assetId}`);
  }

  // Update rights if not yet set
  if (!existingAsset.rights_holder_ref && rightsHolderRef) {
    await supabase
      .from("media_asset")
      .update({ rights_holder_ref: rightsHolderRef, rights_basis: rightsBasis ?? "rights recorded during ingest" })
      .eq("asset_id", assetId);
  }

  // Update intake linkage if provided
  if (intakeId) {
    await supabase
      .from("media_asset")
      .update({ intake_id: intakeId })
      .eq("asset_id", assetId)
      .is("intake_id", null);
  }

  // Idempotency: check if binding already exists
  const { data: existingBinding } = await supabase
    .from("projection_media_binding")
    .select("binding_id, asset_id")
    .eq("projection_id", projectionId)
    .eq("asset_id", assetId)
    .maybeSingle();

  const { data: existingVariant } = await supabase
    .from("delivery_variant")
    .select("variant_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (existingBinding) {
    if (realizationId) {
      await supabase
        .from("projection_media_binding")
        .update({ realization_id: realizationId })
        .eq("binding_id", existingBinding.binding_id);
    }
    return {
      asset_id: existingBinding.asset_id,
      variant_id: existingVariant?.variant_id ?? "",
      binding_id: existingBinding.binding_id,
    };
  }

  const { data: binding, error: bindingError } = await supabase
    .from("projection_media_binding")
    .insert({
      projection_id: projectionId,
      asset_id: assetId,
      binding_type: bindingType,
      access_level: accessLevel,
      created_by: participantId,
      realization_id: realizationId ?? null,
    })
    .select("binding_id")
    .single();

  if (bindingError || !binding) {
    throw new Error(`Failed to insert projection_media_binding: ${bindingError?.message}`);
  }

  return {
    asset_id: assetId,
    variant_id: existingVariant?.variant_id ?? "",
    binding_id: binding.binding_id,
  };
}

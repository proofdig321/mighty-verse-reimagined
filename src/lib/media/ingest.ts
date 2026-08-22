import { createClient } from "@supabase/supabase-js";
import { livepeer } from "@/lib/livepeer/client";
import { mapLivepeerAsset } from "@/lib/livepeer/types";

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

export async function ingestLivepeerAsset(
  livepeerAssetId: string,
  projectionId: string,
  participantId: string,
  bindingType: BindingType = "primary",
  accessLevel: AccessLevel = "public",
  rightsHolderRef?: string | null,
  rightsBasis?: string | null,
  realizationId?: string | null
): Promise<IngestResult> {
  const supabase = getServiceClient();

  // 1. Fetch asset from Livepeer
  const response = await livepeer.asset.get(livepeerAssetId);
  if (!response.asset) {
    throw new Error(`Livepeer asset not found: ${livepeerAssetId}`);
  }

  // 2. Require playbackId — never fall back to asset UUID as storage_ref
  const playbackId = response.asset.playbackId;
  if (!playbackId) {
    throw new Error(`Livepeer asset ${livepeerAssetId} has no playbackId — asset may still be processing`);
  }

  const mapped = mapLivepeerAsset(response.asset);

  // 3. Idempotency check: find any media_asset already stored for this playbackId
  const { data: existingAssets } = await supabase
    .from("media_asset")
    .select("asset_id, rights_holder_ref, rights_basis")
    .eq("storage_ref", playbackId);

  if (existingAssets && existingAssets.length > 0) {
    const existingAssetIds = existingAssets.map((a) => a.asset_id);

    // Check whether one of those assets is already bound to this projection
    const { data: existingBinding } = await supabase
      .from("projection_media_binding")
      .select("binding_id, asset_id")
      .eq("projection_id", projectionId)
      .in("asset_id", existingAssetIds)
      .maybeSingle();

    if (existingBinding) {
      if (realizationId) {
        const { error: realizationError } = await supabase
          .from("projection_media_binding")
          .update({ realization_id: realizationId })
          .eq("binding_id", existingBinding.binding_id);
        if (realizationError) throw new Error(`Failed to associate media realization: ${realizationError.message}`);
      }
      const { data: existingAsset } = await supabase
        .from("media_asset")
        .select("rights_holder_ref, rights_basis")
        .eq("asset_id", existingBinding.asset_id)
        .single();

      if (!existingAsset?.rights_holder_ref && rightsHolderRef) {
        await supabase
          .from("media_asset")
          .update({ rights_holder_ref: rightsHolderRef, rights_basis: rightsBasis ?? "rights recorded during ingest" })
          .eq("asset_id", existingBinding.asset_id);
      }

      const { data: existingVariant } = await supabase
        .from("delivery_variant")
        .select("variant_id")
        .eq("asset_id", existingBinding.asset_id)
        .maybeSingle();

      return {
        asset_id: existingBinding.asset_id,
        variant_id: existingVariant?.variant_id ?? "",
        binding_id: existingBinding.binding_id,
      };
    }

    // Asset exists but not bound to this projection — reuse asset, create only the binding
    const reuseAssetId = existingAssetIds[0];
    const { data: existingVariant } = await supabase
      .from("delivery_variant")
      .select("variant_id")
      .eq("asset_id", reuseAssetId)
      .maybeSingle();

    const { data: newBinding, error: bindingError } = await supabase
      .from("projection_media_binding")
      .insert({
        projection_id: projectionId,
        asset_id: reuseAssetId,
        binding_type: bindingType,
        access_level: accessLevel,
        created_by: participantId,
        realization_id: realizationId,
      })
      .select("binding_id")
      .single();

    if (bindingError || !newBinding) {
      throw new Error(`Failed to insert projection_media_binding: ${bindingError?.message}`);
    }

    return {
      asset_id: reuseAssetId,
      variant_id: existingVariant?.variant_id ?? "",
      binding_id: newBinding.binding_id,
    };
  }

  // 4. No existing media_asset for this playbackId — full creation sequence
  if (!rightsHolderRef) {
    throw new Error("rightsHolderRef is required for new media assets; rights must be recorded at ingest time.");
  }

  const { data: asset, error: assetError } = await supabase
    .from("media_asset")
    .insert({
      asset_type: "streaming-variant",
      storage_ref: playbackId,
      integrity_hash: mapped.integrityHash,
      format: mapped.format,
      resolution: mapped.resolution,
      duration_ms: mapped.durationMs,
      rights_holder_ref: rightsHolderRef,
      rights_basis: rightsBasis ?? "rights recorded during ingest",
    })
    .select("asset_id")
    .single();

  if (assetError || !asset) {
    throw new Error(`Failed to insert media_asset: ${assetError?.message}`);
  }

  const { data: variant, error: variantError } = await supabase
    .from("delivery_variant")
    .insert({
      asset_id: asset.asset_id,
      delivery_format: "hls",
      endpoint_ref: mapped.hlsPlaybackUrl,
    })
    .select("variant_id")
    .single();

  if (variantError || !variant) {
    throw new Error(`Failed to insert delivery_variant: ${variantError?.message}`);
  }

  const { data: binding, error: bindingError } = await supabase
    .from("projection_media_binding")
    .insert({
      projection_id: projectionId,
      asset_id: asset.asset_id,
      binding_type: bindingType,
      access_level: accessLevel,
      created_by: participantId,
      realization_id: realizationId,
    })
    .select("binding_id")
    .single();

  if (bindingError || !binding) {
    throw new Error(`Failed to insert projection_media_binding: ${bindingError?.message}`);
  }

  return {
    asset_id: asset.asset_id,
    variant_id: variant.variant_id,
    binding_id: binding.binding_id,
  };
}

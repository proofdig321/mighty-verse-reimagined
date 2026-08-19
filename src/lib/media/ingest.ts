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
  accessLevel: AccessLevel = "public"
): Promise<IngestResult> {
  const supabase = getServiceClient();

  // 1. Fetch asset from Livepeer
  const response = await livepeer.asset.get(livepeerAssetId);
  if (!response.asset) {
    throw new Error(`Livepeer asset not found: ${livepeerAssetId}`);
  }
  const mapped = mapLivepeerAsset(response.asset);

  // 2. Insert media_asset
  // storage_ref = Livepeer playback ID (used by LivepeerPlayer as playbackId)
  const playbackId = response.asset.playbackId ?? mapped.livepeerAssetId;
  const { data: asset, error: assetError } = await supabase
    .from("media_asset")
    .insert({
      asset_type: "streaming-variant",
      storage_ref: playbackId,
      integrity_hash: mapped.integrityHash,
      format: mapped.format,
      resolution: mapped.resolution,
      duration_ms: mapped.durationMs,
    })
    .select("asset_id")
    .single();

  if (assetError || !asset) {
    throw new Error(`Failed to insert media_asset: ${assetError?.message}`);
  }

  // 3. Insert delivery_variant
  // endpoint_ref = HLS playback URL
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

  // 4. Insert projection_media_binding
  const { data: binding, error: bindingError } = await supabase
    .from("projection_media_binding")
    .insert({
      projection_id: projectionId,
      asset_id: asset.asset_id,
      binding_type: bindingType,
      access_level: accessLevel,
      created_by: participantId,
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

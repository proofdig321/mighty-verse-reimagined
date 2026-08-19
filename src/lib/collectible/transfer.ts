import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type TransferResult = {
  transfer_id: string;
};

export async function transferCollectible(
  collectible_id: string,
  to_participant_id: string,
  transfer_basis: string
): Promise<TransferResult> {
  const supabase = getServiceClient();

  // 1. Read current owner and secondary_waterfall_id
  const { data: collectible, error: readError } = await supabase
    .from("collectible")
    .select("collectible_id, current_owner_ref, secondary_waterfall_id")
    .eq("collectible_id", collectible_id)
    .single();

  if (readError || !collectible) {
    throw new Error(`Collectible not found: ${collectible_id}`);
  }

  // 2. Insert ownership_transfer (append-only)
  // economic_event_id is null — secondary economic event is Step 12
  const { data: transfer, error: transferError } = await supabase
    .from("ownership_transfer")
    .insert({
      collectible_id,
      from_owner_ref: collectible.current_owner_ref,
      to_owner_ref: to_participant_id,
      transfer_basis,
      economic_event_id: null,
    })
    .select("transfer_id")
    .single();

  if (transferError || !transfer) {
    throw new Error(`Failed to insert ownership_transfer: ${transferError?.message}`);
  }

  // 3. Update current_owner_ref — the only permitted mutation on collectible per A3
  const { error: updateError } = await supabase
    .from("collectible")
    .update({ current_owner_ref: to_participant_id })
    .eq("collectible_id", collectible_id);

  if (updateError) {
    throw new Error(`Failed to update current_owner_ref: ${updateError.message}`);
  }

  return { transfer_id: transfer.transfer_id };
}

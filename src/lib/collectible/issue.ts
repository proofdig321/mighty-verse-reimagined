import { createClient } from "@supabase/supabase-js";
import type { CollectibleIssuanceInput } from "./types";
import { recordPrimaryIssuanceEvent } from "@/lib/economic/events";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type IssueResult = {
  collectible_id: string;
  entitlement_bundle_id: string;
  economic_event_id: string;
};

export async function issueCollectible(
  input: CollectibleIssuanceInput & { economic_basis: number; currency?: string }
): Promise<IssueResult> {
  const supabase = getServiceClient();

  // 1. Validate projection exists and is collectible_designated
  const { data: projection, error: projError } = await supabase
    .from("projection")
    .select("projection_id, collectible_designated")
    .eq("projection_id", input.projection_id)
    .single();

  if (projError || !projection) {
    throw new Error(`Projection not found: ${input.projection_id}`);
  }
  if (!projection.collectible_designated) {
    throw new Error(
      `Projection ${input.projection_id} is not collectible_designated`
    );
  }

  // 2. Validate primary_waterfall_version belongs to primary_waterfall_id
  const { data: wv, error: wvError } = await supabase
    .from("waterfall_version")
    .select("waterfall_version_id, waterfall_id")
    .eq("waterfall_version_id", input.primary_waterfall_version)
    .eq("waterfall_id", input.primary_waterfall_id)
    .single();

  if (wvError || !wv) {
    throw new Error(
      `waterfall_version ${input.primary_waterfall_version} does not belong to waterfall ${input.primary_waterfall_id}`
    );
  }

  // 3. Insert entitlement_bundle
  const { data: bundle, error: bundleError } = await supabase
    .from("entitlement_bundle")
    .insert({
      access_rights: input.entitlement_bundle.access_rights,
      recognition_rights: input.entitlement_bundle.recognition_rights,
      transfer_rights: input.entitlement_bundle.transfer_rights,
      economic_entitlements: input.entitlement_bundle.economic_entitlements,
      created_by: input.entitlement_bundle.created_by,
    })
    .select("entitlement_bundle_id")
    .single();

  if (bundleError || !bundle) {
    throw new Error(`Failed to insert entitlement_bundle: ${bundleError?.message}`);
  }

  // 4. Insert collectible with all immutable issuance fields
  const { data: collectible, error: collectibleError } = await supabase
    .from("collectible")
    .insert({
      collectible_class: input.collectible_class,
      projection_id: input.projection_id,
      canonical_state_id: input.canonical_state_id,
      master_id: input.master_id,
      provenance_id: input.provenance_id,
      issuance_id: input.issuance_id,
      edition_info: input.edition_info ?? null,
      issued_by: input.issued_by,
      primary_waterfall_id: input.primary_waterfall_id,
      primary_waterfall_version: input.primary_waterfall_version,
      secondary_waterfall_id: input.secondary_waterfall_id ?? null,
      secondary_waterfall_version: input.secondary_waterfall_version ?? null,
      entitlement_bundle_id: bundle.entitlement_bundle_id,
      economic_rule_snapshot: input.economic_rule_snapshot,
      current_owner_ref: input.initial_owner_ref ?? null,
      ownership_rail: "web2",
    })
    .select("collectible_id")
    .single();

  if (collectibleError || !collectible) {
    throw new Error(`Failed to insert collectible: ${collectibleError?.message}`);
  }

  return {
    collectible_id: collectible.collectible_id,
    entitlement_bundle_id: bundle.entitlement_bundle_id,
    economic_event_id: await recordPrimaryIssuanceEvent(
      collectible.collectible_id,
      input.economic_basis,
      input.currency ?? "USD"
    ),
  };
}

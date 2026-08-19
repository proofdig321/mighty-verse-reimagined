import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// A9: corrections are new events — original records never modified except status field
export async function recordCorrection(
  originalEventId: string,
  correctionType:
    | "correction"
    | "reversal"
    | "refund"
    | "attribution-correction"
    | "provenance-correction"
    | "participant-correction"
    | "rule-correction",
  reason: string,
  basis: string,
  newEntitlements: {
    participant_ref: string;
    participant_role: string;
    calculation_basis: number;
    calculation_method: "percentage" | "fixed" | "formula";
    calculation_value: string;
    entitlement_amount: number;
    currency: string;
  }[]
): Promise<{ correction_event_id: string }> {
  const supabase = getServiceClient();

  const { data: original, error } = await supabase
    .from("economic_event")
    .select("*")
    .eq("event_id", originalEventId)
    .single();

  if (error || !original) throw new Error(`Original event not found: ${originalEventId}`);
  if (original.status !== "active") throw new Error("Event is already corrected or reversed");

  // Insert correction event
  const { data: corrEvt, error: corrErr } = await supabase
    .from("economic_event")
    .insert({
      event_type: original.event_type,
      attributed: original.attributed,
      master_id: original.master_id,
      canonical_state_id: original.canonical_state_id,
      projection_id: original.projection_id,
      collectible_id: original.collectible_id,
      provenance_id: original.provenance_id,
      attribution_snapshot: original.attribution_snapshot,
      waterfall_version_id: original.waterfall_version_id,
      economic_basis: original.economic_basis,
      currency: original.currency,
      occurred_at: original.occurred_at,
      calculated_at: new Date().toISOString(),
      correction_of: originalEventId,
      correction_type: correctionType,
      correction_reason: reason,
      correction_basis: basis,
    })
    .select("event_id")
    .single();

  if (corrErr || !corrEvt) throw new Error(`Failed to insert correction event: ${corrErr?.message}`);

  // Set original event status — only permitted mutation per A9
  await supabase
    .from("economic_event")
    .update({ status: correctionType === "reversal" ? "reversed" : "corrected" })
    .eq("event_id", originalEventId);

  // Reverse all original entitlements
  await supabase
    .from("economic_entitlement")
    .update({ settlement_state: "Reversed" })
    .eq("event_id", originalEventId);

  // Insert new entitlements on correction event
  if (newEntitlements.length > 0) {
    await supabase.from("economic_entitlement").insert(
      newEntitlements.map((e) => ({
        ...e,
        event_id: corrEvt.event_id,
        settlement_state: "Calculated",
      }))
    );
  }

  return { correction_event_id: corrEvt.event_id };
}

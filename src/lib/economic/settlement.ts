import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SettlementState = "Calculated" | "Accrued" | "Payable" | "Settled" | "Held" | "Reversed";

// A8: only these transitions are valid
const VALID_TRANSITIONS: Record<SettlementState, SettlementState[]> = {
  Calculated: ["Accrued", "Payable", "Held"],
  Accrued:    ["Payable", "Held"],
  Payable:    ["Settled", "Held", "Reversed"],
  Held:       ["Payable", "Reversed"],
  Settled:    ["Reversed"],
  Reversed:   [],
};

export async function advanceSettlementState(
  entitlementId: string,
  toState: SettlementState,
  _reason?: string
): Promise<SettlementState> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("economic_entitlement")
    .select("settlement_state")
    .eq("entitlement_id", entitlementId)
    .single();

  if (error || !data) throw new Error(`Entitlement not found: ${entitlementId}`);

  const current = data.settlement_state as SettlementState;
  if (!VALID_TRANSITIONS[current].includes(toState)) {
    throw new Error(`Invalid transition: ${current} → ${toState}`);
  }

  await supabase
    .from("economic_entitlement")
    .update({ settlement_state: toState })
    .eq("entitlement_id", entitlementId);

  return toState;
}

export async function createSettlementRecord(
  entitlementIds: string[],
  amount: number,
  currency: string,
  method: "web2-payment" | "web3-transfer" | "other",
  ref?: string
): Promise<string> {
  const supabase = getServiceClient();

  // Validate all entitlements are Payable
  const { data: ents, error } = await supabase
    .from("economic_entitlement")
    .select("entitlement_id, settlement_state")
    .in("entitlement_id", entitlementIds);

  if (error || !ents) throw new Error("Failed to fetch entitlements");

  const notPayable = ents.filter((e) => e.settlement_state !== "Payable");
  if (notPayable.length > 0) {
    throw new Error(
      `Entitlements not in Payable state: ${notPayable.map((e) => e.entitlement_id).join(", ")}`
    );
  }

  const { data: rec, error: recErr } = await supabase
    .from("settlement_record")
    .insert({
      entitlement_ids: entitlementIds,
      settlement_amount: amount,
      currency,
      settlement_method: method,
      settlement_ref: ref ?? null,
      settlement_state: "completed",
    })
    .select("settlement_id")
    .single();

  if (recErr || !rec) throw new Error(`Failed to insert settlement record: ${recErr?.message}`);

  // Transition all entitlements to Settled and wire settlement_ref
  await supabase
    .from("economic_entitlement")
    .update({ settlement_state: "Settled", settlement_ref: rec.settlement_id })
    .in("entitlement_id", entitlementIds);

  return rec.settlement_id;
}

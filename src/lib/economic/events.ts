import { createClient } from "@supabase/supabase-js";
import { resolveWaterfallVersion, type WaterfallParticipantEntry } from "./waterfall";
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function calcEntitlementAmount(
  basis: number,
  method: "percentage" | "fixed" | "formula",
  value: string
): number {
  if (method === "percentage") return (basis * parseFloat(value)) / 100;
  if (method === "fixed") return parseFloat(value);
  // formula: not yet implemented — return 0 and log
  console.warn("formula calculation_method not yet implemented for value:", value);
  return 0;
}

 
async function insertEntitlements(
   
  supabase: any,
  eventId: string,
  participants: WaterfallParticipantEntry[],
  economicBasis: number,
  currency: string,
  calculationMode: "independent" | "sequential"
) {
  let remainder = economicBasis;

  for (const p of participants) {
    const basis = calculationMode === "sequential" ? remainder : economicBasis;
    const amount = calcEntitlementAmount(basis, p.calculation_method, p.value);

     
    await (supabase.from("economic_entitlement") as any).insert({
      event_id: eventId,
      participant_ref: p.role,
      participant_role: p.role,
      calculation_basis: basis,
      calculation_method: p.calculation_method,
      calculation_value: p.value,
      entitlement_amount: amount,
      currency,
      settlement_state: "Calculated",
    });

    if (calculationMode === "sequential") remainder -= amount;
  }
}

// A6: primary issuance always uses collectible's primary_waterfall_version — never platform default
export async function recordPrimaryIssuanceEvent(
  collectibleId: string,
  economicBasis: number,
  currency = "USD"
): Promise<string> {
  const supabase = getServiceClient();

  const { data: col, error } = await supabase
    .from("collectible")
    .select(
      "canonical_state_id, master_id, projection_id, provenance_id, primary_waterfall_version, economic_rule_snapshot"
    )
    .eq("collectible_id", collectibleId)
    .single();

  if (error || !col) throw new Error(`Collectible not found: ${collectibleId}`);

  const { data: wv, error: wvErr } = await supabase
    .from("waterfall_version")
    .select("waterfall_version_id, calculation_mode, participants")
    .eq("waterfall_version_id", col.primary_waterfall_version)
    .single();

  if (wvErr || !wv) throw new Error("Primary waterfall version not found");

  const { data: evt, error: evtErr } = await supabase
    .from("economic_event")
    .insert({
      event_type: "primary-issuance",
      attributed: true,
      master_id: col.master_id,
      canonical_state_id: col.canonical_state_id,
      projection_id: col.projection_id,
      collectible_id: collectibleId,
      provenance_id: col.provenance_id,
      attribution_snapshot: col.economic_rule_snapshot,
      waterfall_version_id: wv.waterfall_version_id,
      economic_basis: economicBasis,
      currency,
      occurred_at: new Date().toISOString(),
      calculated_at: new Date().toISOString(),
    })
    .select("event_id")
    .single();

  if (evtErr || !evt) throw new Error(`Failed to insert primary issuance event: ${evtErr?.message}`);

  await insertEntitlements(
    supabase,
    evt.event_id,
    wv.participants as WaterfallParticipantEntry[],
    economicBasis,
    currency,
    wv.calculation_mode as "independent" | "sequential"
  );

  return evt.event_id;
}

// A6: secondary transfer uses collectible's secondary_waterfall_version; null = no secondary economics
export async function recordSecondaryTransferEvent(
  transferId: string,
  collectibleId: string,
  economicBasis: number,
  currency = "USD"
): Promise<string | null> {
  const supabase = getServiceClient();

  const { data: col, error } = await supabase
    .from("collectible")
    .select(
      "canonical_state_id, master_id, projection_id, provenance_id, secondary_waterfall_version, economic_rule_snapshot"
    )
    .eq("collectible_id", collectibleId)
    .single();

  if (error || !col) throw new Error(`Collectible not found: ${collectibleId}`);
  if (!col.secondary_waterfall_version) return null; // no secondary economics

  const { data: wv, error: wvErr } = await supabase
    .from("waterfall_version")
    .select("waterfall_version_id, calculation_mode, participants")
    .eq("waterfall_version_id", col.secondary_waterfall_version)
    .single();

  if (wvErr || !wv) throw new Error("Secondary waterfall version not found");

  const { data: evt, error: evtErr } = await supabase
    .from("economic_event")
    .insert({
      event_type: "secondary-transfer",
      attributed: true,
      master_id: col.master_id,
      canonical_state_id: col.canonical_state_id,
      projection_id: col.projection_id,
      collectible_id: collectibleId,
      provenance_id: col.provenance_id,
      attribution_snapshot: col.economic_rule_snapshot,
      waterfall_version_id: wv.waterfall_version_id,
      economic_basis: economicBasis,
      currency,
      transfer_id: transferId,
      occurred_at: new Date().toISOString(),
      calculated_at: new Date().toISOString(),
    })
    .select("event_id")
    .single();

  if (evtErr || !evt) throw new Error(`Failed to insert secondary transfer event: ${evtErr?.message}`);

  await insertEntitlements(
    supabase,
    evt.event_id,
    wv.participants as WaterfallParticipantEntry[],
    economicBasis,
    currency,
    wv.calculation_mode as "independent" | "sequential"
  );

  // Wire economic_event_id back onto ownership_transfer
  await supabase
    .from("ownership_transfer")
    .update({ economic_event_id: evt.event_id })
    .eq("transfer_id", transferId);

  return evt.event_id;
}

// A7: attributed = true only when signal has high/medium confidence with resolvable master_id
export async function recordConsumptionEvent(signalId: string): Promise<string> {
  const supabase = getServiceClient();

  const { data: sig, error } = await supabase
    .from("consumption_signal")
    .select("*")
    .eq("signal_id", signalId)
    .single();

  if (error || !sig) throw new Error(`ConsumptionSignal not found: ${signalId}`);

  const attributed = sig.attribution_confidence !== "low";
  const occurredAt = new Date(sig.occurred_at);

  let waterfallVersionId: string | null = null;
  let participants: WaterfallParticipantEntry[] = [];
  let calculationMode: "independent" | "sequential" = "independent";

  if (attributed) {
    const resolved = await resolveWaterfallVersion(
      sig.projection_id,
      "projection",
      "consumption",
      occurredAt
    );
    if (resolved) {
      waterfallVersionId = resolved.waterfall_version_id;
      participants = resolved.participants;
      calculationMode = resolved.calculation_mode;
    }
  } else {
    // Unattributed: resolve platform-level consumption waterfall
    const resolved = await resolveWaterfallVersion(null, "platform", "consumption", occurredAt);
    if (resolved) {
      waterfallVersionId = resolved.waterfall_version_id;
      participants = resolved.participants;
      calculationMode = resolved.calculation_mode;
    }
  }

  const { data: evt, error: evtErr } = await supabase
    .from("economic_event")
    .insert({
      event_type: "consumption",
      attributed,
      master_id: attributed ? sig.master_id : null,
      canonical_state_id: attributed ? sig.canonical_state_id : null,
      projection_id: attributed ? sig.projection_id : null,
      attribution_basis: signalId,
      waterfall_version_id: waterfallVersionId,
      economic_basis: null, // set by billing/settlement step
      currency: "USD",
      occurred_at: sig.occurred_at,
      calculated_at: new Date().toISOString(),
    })
    .select("event_id")
    .single();

  if (evtErr || !evt) throw new Error(`Failed to insert consumption event: ${evtErr?.message}`);

  // Only insert entitlements if waterfall resolved and economic_basis is known
  // (basis is set at settlement time for consumption; entitlements created then)

  return evt.event_id;
}

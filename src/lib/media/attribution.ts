import { recordConsumptionEvent } from "@/lib/economic/events";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AttributionResult = {
  event_id: string;
  attributed: boolean;
  skipped: boolean;
};

// Single authoritative entry point: ConsumptionSignal → EconomicEvent.
// Called by POST /api/economic/events (direct) and n8n webhook (Step 13).
export async function processSignalAttribution(
  signalId: string
): Promise<AttributionResult> {
  const supabase = getServiceClient();

  // Deduplication: if an economic_event already references this signal, skip
  const { data: existing } = await supabase
    .from("economic_event")
    .select("event_id, attributed")
    .eq("attribution_basis", signalId)
    .maybeSingle();

  if (existing) {
    return { event_id: existing.event_id, attributed: existing.attributed, skipped: true };
  }

  const { data: sig } = await supabase
    .from("consumption_signal")
    .select("attribution_confidence")
    .eq("signal_id", signalId)
    .single();

  if (!sig) throw new Error(`ConsumptionSignal not found: ${signalId}`);

  const event_id = await recordConsumptionEvent(signalId);
  const attributed = sig.attribution_confidence !== "low";

  return { event_id, attributed, skipped: false };
}

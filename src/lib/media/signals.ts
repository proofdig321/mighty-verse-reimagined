import { createClient } from "@supabase/supabase-js";

type SignalType = "play" | "pause" | "complete" | "interaction" | "ad-impression" | "ad-view";
type AttributionConfidence = "high" | "medium" | "low";

export type ConsumptionSignalInsert = {
  sessionRef: string;
  participantRef: string | null;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  signalType: SignalType;
  occurredAt: Date;
  attributionConfidence: AttributionConfidence;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function recordConsumptionSignal(
  signal: ConsumptionSignalInsert
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase.from("consumption_signal").insert({
    session_ref: signal.sessionRef,
    participant_ref: signal.participantRef,
    projection_id: signal.projectionId,
    master_id: signal.masterId,
    canonical_state_id: signal.canonicalStateId,
    signal_type: signal.signalType,
    occurred_at: signal.occurredAt.toISOString(),
    attribution_confidence: signal.attributionConfidence,
  });

  if (error) {
    throw new Error(`Failed to record consumption signal: ${error.message}`);
  }
}

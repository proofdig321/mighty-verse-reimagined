import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type AttachmentLevel =
  | "platform"
  | "work"
  | "projection"
  | "collectible-class"
  | "collectible";

export type WaterfallParticipantEntry = {
  role: string;
  entitlement_basis: string;
  calculation_method: "percentage" | "fixed" | "formula";
  value: string;
  order: number | null;
  conditions: Record<string, unknown> | null;
};

export type ResolvedWaterfall = {
  waterfall_version_id: string;
  calculation_mode: "independent" | "sequential";
  participants: WaterfallParticipantEntry[];
};

// A4 rule resolution: walk attachment levels from most specific to least specific.
// Returns the waterfall version whose effective_from <= occurred_at < effective_to (or null).
export async function resolveWaterfallVersion(
  subjectId: string | null,
  subjectType: AttachmentLevel,
  channel: string,
  occurredAt: Date
): Promise<ResolvedWaterfall | null> {
  const supabase = getServiceClient();
  const ts = occurredAt.toISOString();

  const levels: AttachmentLevel[] = [
    "collectible",
    "collectible-class",
    "projection",
    "work",
    "platform",
  ];

  for (const level of levels) {
    // Only check levels at or above the subject's specificity
    if (
      subjectId === null &&
      level !== "platform"
    ) continue;

    const { data } = await supabase
      .from("rule_attachment")
      .select(
        "waterfall_version_id, waterfall_version!inner(waterfall_version_id, calculation_mode, participants, waterfall_definition!inner(economic_channel))"
      )
      .eq("attachment_level", level)
      .lte("effective_from", ts)
      .or("effective_to.is.null,effective_to.gt." + ts)
      .eq(
        "waterfall_version.waterfall_definition.economic_channel",
        channel
      )
      .match(
        subjectId && level !== "platform"
          ? { subject_id: subjectId }
          : {}
      )
      .limit(1)
      .maybeSingle();

    if (data) {
       
      const wv = (data as any).waterfall_version as {
        waterfall_version_id: string;
        calculation_mode: "independent" | "sequential";
        participants: WaterfallParticipantEntry[];
      };
      return {
        waterfall_version_id: wv.waterfall_version_id,
        calculation_mode: wv.calculation_mode,
        participants: wv.participants ?? [],
      };
    }
  }

  return null;
}

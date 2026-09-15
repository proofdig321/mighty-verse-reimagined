import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { discardMediaIntake } from "@/lib/authority/operations";

/**
 * POST /api/authority/media-intake/[intakeId]/discard
 *
 * Hide an unlinked intake from Gallery awaiting-upload. Not a canonical delete.
 * Intakes already linked to media, or to Super Hero Ego / Father Raymond, are refused.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ intakeId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { intakeId } = await params;
  const result = await discardMediaIntake(participantId, intakeId);
  if ("error" in result) {
    const status = /cannot be deleted|already linked|already removed/i.test(result.error)
      ? 409
      : /not found/i.test(result.error)
        ? 404
        : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ discarded: true, intake_id: result.data.intake_id });
}

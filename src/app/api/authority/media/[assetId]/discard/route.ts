import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { discardMediaAsset } from "@/lib/authority/operations";

/**
 * POST /api/authority/media/[assetId]/discard
 *
 * Hide incoming media from operator catalogues. Not a canonical delete.
 * Super Hero Ego and Father Raymond playback assets are refused.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { assetId } = await params;
  const result = await discardMediaAsset(participantId, assetId);
  if ("error" in result) {
    const status = /cannot be deleted|attached to live/i.test(result.error)
      ? 409
      : /not found/i.test(result.error)
        ? 404
        : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ discarded: true, asset_id: result.data.asset_id });
}

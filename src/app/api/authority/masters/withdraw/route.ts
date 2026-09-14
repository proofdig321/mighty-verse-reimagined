import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { withdrawMaster } from "@/lib/authority/operations";

/**
 * POST /api/authority/masters/withdraw
 * Body: { master_id }
 *
 * Authority withdraw. Not a CMS delete. Super Hero Ego is refused.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const body = await request.json().catch(() => null) as { master_id?: unknown } | null;
  const master_id = typeof body?.master_id === "string" ? body.master_id.trim() : "";
  if (!master_id) return NextResponse.json({ error: "master_id required" }, { status: 400 });

  const result = await withdrawMaster(participantId, master_id);
  if ("error" in result) {
    const status = /Super Hero Ego/.test(result.error) ? 409 : /not found/i.test(result.error) ? 404 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    withdrawn: true,
    already: result.data.already,
    master_ids: result.data.master_ids,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { createProjection } from "@/lib/authority/operations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { canonical_state_id, master_id, projection_type } = await request.json();
  if (!canonical_state_id || !master_id || !projection_type) {
    return NextResponse.json({ error: "canonical_state_id, master_id, projection_type required" }, { status: 400 });
  }

  const result = await createProjection(participantId, canonical_state_id, master_id, projection_type);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { designateCollectible } from "@/lib/authority/operations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { projection_id, master_id } = await request.json();
  if (!projection_id || !master_id) {
    return NextResponse.json({ error: "projection_id, master_id required" }, { status: 400 });
  }

  const result = await designateCollectible(participantId, projection_id, master_id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data);
}

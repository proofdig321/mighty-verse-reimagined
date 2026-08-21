import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { registerMaster, addAttribution } from "@/lib/authority/operations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { canonical_type, parent_master_id } = await request.json();
  if (!canonical_type) return NextResponse.json({ error: "canonical_type required" }, { status: 400 });

  const result = await registerMaster(participantId, canonical_type, parent_master_id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });

  const { master_id } = result.data;

  // For song-world: explicitly attribute original-artist and director (per I.1.B and I.1.C)
  // For mural: no auto-attribution — Director must be added via a separate explicit call
  // For other types: no auto-attribution
  if (canonical_type === "song-world") {
    await addAttribution(participantId, master_id, "original-artist", "Canonical creator", true);
    await addAttribution(participantId, master_id, "director", "Director", true);
  }

  return NextResponse.json(result.data, { status: 201 });
}

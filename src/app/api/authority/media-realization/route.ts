import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { createMediaRealization } from "@/lib/authority/operations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { master_id, realization_type, rights_holder_ref, rights_basis, production_notes } = await request.json();
  if (!master_id || !realization_type) {
    return NextResponse.json({ error: "master_id and realization_type required" }, { status: 400 });
  }

  const result = await createMediaRealization(
    participantId,
    master_id,
    realization_type,
    rights_holder_ref ?? null,
    rights_basis ?? null,
    production_notes ?? null
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data, { status: 201 });
}

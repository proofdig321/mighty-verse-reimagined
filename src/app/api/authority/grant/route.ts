import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { grantAuthority } from "@/lib/authority/operations";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { target_participant_id, scope_type, scope_subject_id, capabilities, authorisation_evidence } = await request.json();
  if (!target_participant_id || !scope_type || !capabilities || !Array.isArray(capabilities)) {
    return NextResponse.json({ error: "target_participant_id, scope_type, and capabilities required" }, { status: 400 });
  }

  const result = await grantAuthority(
    participantId,
    target_participant_id,
    scope_type,
    scope_subject_id ?? null,
    capabilities,
    "delegated",
    authorisation_evidence ?? null
  );

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result.data, { status: 201 });
}

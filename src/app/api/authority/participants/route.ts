import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

// POST /api/authority/participants
// Body: { label, identity_ref?, role_type? }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const { label, identity_ref, role_type } = await request.json();
  if (!label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  const svc = getServiceClient();

  const { data: participant, error: pErr } = await svc
    .from("participant")
    .insert({ label: label.trim(), status: "active" })
    .select("participant_id")
    .single();

  if (pErr || !participant) {
    return NextResponse.json({ error: pErr?.message ?? "Failed to create participant" }, { status: 500 });
  }

  if (identity_ref?.trim()) {
    await svc.from("identity_link").insert({
      participant_id: participant.participant_id,
      identity_ref: identity_ref.trim(),
      active: true,
    });
  }

  if (role_type?.trim()) {
    await svc.from("participant_role").insert({
      participant_id: participant.participant_id,
      role_type: role_type.trim(),
    });
  }

  return NextResponse.json({ participant_id: participant.participant_id }, { status: 201 });
}

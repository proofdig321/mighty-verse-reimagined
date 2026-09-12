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

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorId = await getParticipantId(supabase);
  if (!actorId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const auth = await validateAuthority(actorId, "create-canonical-state", null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const targetId = typeof body.participant_id === "string" ? body.participant_id : "";
  if (!targetId) return NextResponse.json({ error: "participant_id required" }, { status: 400 });

  const svc = getServiceClient();
  const { data: existing } = await svc.from("participant").select("participant_id, status").eq("participant_id", targetId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Participant was not found." }, { status: 404 });

  const nextStatus = typeof body.status === "string" ? body.status.trim() : null;
  if (nextStatus === "inactive" && targetId === actorId) {
    return NextResponse.json({ error: "You cannot deactivate your own participant record." }, { status: 400 });
  }
  if (nextStatus && nextStatus !== "active" && nextStatus !== "inactive") {
    return NextResponse.json({ error: "status must be active or inactive" }, { status: 400 });
  }

  const patch: { label?: string; status?: string } = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (nextStatus) patch.status = nextStatus;
  if (Object.keys(patch).length) {
    const { error } = await svc.from("participant").update(patch).eq("participant_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.role_type === "string") {
    await svc.from("participant_role").delete().eq("participant_id", targetId);
    if (body.role_type.trim()) {
      const { error } = await svc.from("participant_role").insert({
        participant_id: targetId,
        role_type: body.role_type.trim(),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    participant_id: targetId,
    label: patch.label ?? null,
    status: patch.status ?? existing.status,
    role: typeof body.role_type === "string" ? (body.role_type.trim() || null) : undefined,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";
import {
  isParticipantRoleType,
  normalizeParticipantStatus,
} from "@/lib/participants/names";
import { setParticipantStatus, upsertParticipantDisplayName } from "@/lib/participants/operational";

function identityTypeForRef(identityRef: string): "email" | "other" {
  return identityRef.includes("@") ? "email" : "other";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });

  const identityRef = typeof body.identity_ref === "string" ? body.identity_ref.trim() : "";
  const roleType = typeof body.role_type === "string" ? body.role_type.trim() : "";
  if (roleType && !isParticipantRoleType(roleType)) {
    return NextResponse.json({ error: "role_type is not a recognised participant role" }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: participant, error: pErr } = await svc
    .from("participant")
    .insert({ status: "active" })
    .select("participant_id")
    .single();

  if (pErr || !participant) {
    return NextResponse.json({ error: pErr?.message ?? "Failed to create participant" }, { status: 500 });
  }

  try {
    await upsertParticipantDisplayName(participant.participant_id, label);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to store display name" }, { status: 500 });
  }

  if (identityRef) {
    const { error } = await svc.from("identity_link").insert({
      participant_id: participant.participant_id,
      identity_type: identityTypeForRef(identityRef),
      identity_ref: identityRef,
      active: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (roleType) {
    const { error } = await svc.from("participant_role").insert({
      participant_id: participant.participant_id,
      role_type: roleType,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    participant_id: participant.participant_id,
    label,
    status: "active",
    role: roleType || null,
  }, { status: 201 });
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

  const nextStatus = typeof body.status === "string" ? normalizeParticipantStatus(body.status.trim()) : null;
  if (typeof body.status === "string" && !nextStatus) {
    return NextResponse.json({ error: "status must be active or suspended" }, { status: 400 });
  }
  if (nextStatus === "deleted") {
    return NextResponse.json({ error: "Use suspend to deactivate a participant." }, { status: 400 });
  }
  if (nextStatus && nextStatus !== "active" && targetId === actorId) {
    return NextResponse.json({ error: "You cannot deactivate your own participant record." }, { status: 400 });
  }

  if (nextStatus) {
    try {
      await setParticipantStatus(targetId, nextStatus);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update status" }, { status: 500 });
    }
  }

  const nextLabel = typeof body.label === "string" ? body.label.trim() : "";
  if (nextLabel) {
    try {
      await upsertParticipantDisplayName(targetId, nextLabel);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update display name" }, { status: 500 });
    }
  }

  if (typeof body.role_type === "string") {
    const roleType = body.role_type.trim();
    if (roleType && !isParticipantRoleType(roleType)) {
      return NextResponse.json({ error: "role_type is not a recognised participant role" }, { status: 400 });
    }
    await svc.from("participant_role").delete().eq("participant_id", targetId);
    if (roleType) {
      const { error } = await svc.from("participant_role").insert({
        participant_id: targetId,
        role_type: roleType,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    participant_id: targetId,
    label: nextLabel || null,
    status: nextStatus ?? existing.status,
    role: typeof body.role_type === "string" ? (body.role_type.trim() || null) : undefined,
  });
}

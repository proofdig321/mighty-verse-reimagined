import { getServiceClient } from "@/lib/authority/validate";
import {
  displayNameFromIdentityRef,
  encodeDisplayIdentityRef,
  PARTICIPANT_DISPLAY_PREFIX,
  pickPublicDisplayName,
  type ParticipantStatus,
} from "@/lib/participants/names";

export type OperationalParticipant = {
  participant_id: string;
  label: string | null;
  status: string | null;
  role: string | null;
};

type IdentityLinkRow = {
  link_id: string;
  participant_id: string;
  identity_type: string;
  identity_ref: string;
  active: boolean;
};

export async function loadOperationalParticipants(): Promise<OperationalParticipant[]> {
  const svc = getServiceClient();
  const { data: participants, error } = await svc
    .from("participant")
    .select("participant_id, status")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error || !participants?.length) return [];

  const ids = participants.map((p) => p.participant_id);
  const [{ data: roles }, { data: links }, { data: attrEntries }] = await Promise.all([
    svc.from("participant_role").select("participant_id, role_type").in("participant_id", ids),
    svc
      .from("identity_link")
      .select("link_id, participant_id, identity_type, identity_ref, active")
      .in("participant_id", ids)
      .eq("active", true),
    svc
      .from("attribution_entry")
      .select("participant_id, contribution_description, public")
      .in("participant_id", ids)
      .eq("public", true),
  ]);

  return participants.map((p) => {
    const displayLink = ((links ?? []) as IdentityLinkRow[]).find(
      (link) => link.participant_id === p.participant_id && displayNameFromIdentityRef(link.identity_ref),
    );
    const attributions = (attrEntries ?? []).filter((entry) => entry.participant_id === p.participant_id);
    return {
      participant_id: p.participant_id,
      label: displayNameFromIdentityRef(displayLink?.identity_ref) ?? pickPublicDisplayName(attributions),
      status: p.status,
      role: (roles ?? []).find((r) => r.participant_id === p.participant_id)?.role_type ?? null,
    };
  });
}

export async function upsertParticipantDisplayName(participantId: string, name: string) {
  const svc = getServiceClient();
  const encoded = encodeDisplayIdentityRef(name);
  const { data: links } = await svc
    .from("identity_link")
    .select("link_id, identity_ref")
    .eq("participant_id", participantId)
    .eq("identity_type", "other")
    .eq("active", true);

  const existing = (links ?? []).find((link) => link.identity_ref.startsWith(PARTICIPANT_DISPLAY_PREFIX));
  if (existing) {
    const { error } = await svc.from("identity_link").update({ identity_ref: encoded }).eq("link_id", existing.link_id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await svc.from("identity_link").insert({
    participant_id: participantId,
    identity_type: "other",
    identity_ref: encoded,
    active: true,
  });
  if (error) throw new Error(error.message);
}

export async function setParticipantStatus(participantId: string, status: ParticipantStatus) {
  const svc = getServiceClient();
  const { error } = await svc.from("participant").update({ status }).eq("participant_id", participantId);
  if (error) throw new Error(error.message);
}

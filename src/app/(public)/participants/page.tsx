export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import ParticipantsFilterClient from "@/components/participants-filter-client";
import { pickPublicDisplayName } from "@/lib/participants/names";

type ParticipantItem = {
  participant_id: string;
  display_name: string;
  role: string | null;
};

async function getData(): Promise<ParticipantItem[]> {
  const svc = getServiceClient();

  const { data: participants, error } = await svc
    .from("participant")
    .select("participant_id")
    .eq("status", "active");

  if (error || !participants?.length) return [];

  const ids = participants.map((p) => p.participant_id);

  const [{ data: roles }, { data: attrEntries }] = await Promise.all([
    svc.from("participant_role").select("participant_id, role_type").in("participant_id", ids),
    svc
      .from("attribution_entry")
      .select("participant_id, contribution_description, role_type, public, privacy_level")
      .in("participant_id", ids)
      .eq("public", true),
  ]);

  const publicByParticipant = new Map<string, Array<{ contribution_description: string | null; role_type: string | null }>>();
  for (const entry of attrEntries ?? []) {
    if (entry.privacy_level === "private-participant") continue;
    const list = publicByParticipant.get(entry.participant_id) ?? [];
    list.push({
      contribution_description: entry.contribution_description,
      role_type: entry.role_type,
    });
    publicByParticipant.set(entry.participant_id, list);
  }

  return participants.flatMap((p) => {
    const entries = publicByParticipant.get(p.participant_id) ?? [];
    const display_name = pickPublicDisplayName(entries);
    if (!display_name) return [];
    const attributionRole = entries.find((entry) => entry.role_type)?.role_type ?? null;
    return [{
      participant_id: p.participant_id,
      display_name,
      role: (roles ?? []).find((r) => r.participant_id === p.participant_id)?.role_type ?? attributionRole,
    }];
  });
}

export default async function ParticipantsPublicPage() {
  const participants = await getData();
  return (
    <div className="public-page">
      <ParticipantsFilterClient participants={participants} />
    </div>
  );
}

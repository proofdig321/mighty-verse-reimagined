"use client";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import ParticipantsClient from "./participants-client";

export const dynamic = "force-dynamic";

type ParticipantRow = {
  participant_id: string;
  label: string | null;
  status: string | null;
  role: string | null;
};

async function getData(): Promise<ParticipantRow[]> {
  const svc = getServiceClient();

  const { data: participants } = await svc
    .from("participant")
    .select("participant_id, label, status");

  if (!participants?.length) return [];

  const ids = participants.map((p) => p.participant_id);

  const { data: roles } = await svc
    .from("participant_role")
    .select("participant_id, role_type")
    .in("participant_id", ids);

  return participants.map((p) => ({
    participant_id: p.participant_id,
    label: p.label ?? null,
    status: p.status ?? null,
    role: (roles ?? []).find((r) => r.participant_id === p.participant_id)?.role_type ?? null,
  }));
}

export default async function ParticipantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const participants = await getData();

  return <ParticipantsClient participants={participants} />;
}

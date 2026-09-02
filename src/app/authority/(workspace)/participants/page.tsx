export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import ParticipantsFilterClient from "@/components/participants-filter-client";
import { Button } from "@/components/ui/button";

type ParticipantItem = {
  participant_id: string;
  display_name: string | null;
  role: string | null;
};

async function getData(): Promise<ParticipantItem[]> {
  const svc = getServiceClient();

  const { data: participants } = await svc
    .from("participant")
    .select("participant_id")
    .eq("active", true);

  if (!participants?.length) return [];

  const ids = participants.map((p) => p.participant_id);

  const { data: roles } = await svc
    .from("participant_role")
    .select("participant_id, role_type")
    .in("participant_id", ids)
    .eq("active", true);

  return participants.map((p) => ({
    participant_id: p.participant_id,
    display_name: null,
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

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold text-foreground"
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          Creators &amp; Participants
        </h1>
        <p className="text-sm text-muted-foreground mt-1">The people building the universes.</p>
      </div>
      <ParticipantsFilterClient participants={participants} />
      <div className="pt-2">
        <Button variant="outline">View All Participants</Button>
      </div>
    </div>
  );
}

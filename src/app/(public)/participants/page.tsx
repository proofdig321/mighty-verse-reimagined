export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
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

export default async function ParticipantsPublicPage() {
  const participants = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/participants" />
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div>
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Creators & Participants
          </h1>
          <p className="text-sm text-muted-foreground mt-1">The people building the universes.</p>
        </div>
        <ParticipantsFilterClient participants={participants} />
        <div className="pt-2">
          <Button variant="outline">View All Participants</Button>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import ParticipantsFilterClient from "@/components/participants-filter-client";

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
    .eq("status", "active");

  if (!participants?.length) return [];

  const ids = participants.map((p) => p.participant_id);

  const [{ data: roles }, { data: attrEntries }] = await Promise.all([
    svc.from("participant_role").select("participant_id, role_type").in("participant_id", ids),
    svc.from("attribution_entry").select("participant_id, contribution_description").in("participant_id", ids).eq("public", true),
  ]);

  return participants.map((p) => {
    const entry = (attrEntries ?? []).find((e) => e.participant_id === p.participant_id);
    const rawDesc = entry?.contribution_description ?? null;
    const display_name = rawDesc?.includes("—")
      ? rawDesc.split("—").pop()?.trim() ?? null
      : rawDesc;
    return {
      participant_id: p.participant_id,
      display_name,
      role: (roles ?? []).find((r) => r.participant_id === p.participant_id)?.role_type ?? null,
    };
  });
}

export default async function ParticipantsPublicPage() {
  const participants = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/participants" />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Creators & Participants
          </h1>
          <p className="text-sm text-muted-foreground mt-1">The people building the universes.</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <ParticipantsFilterClient participants={participants} />
      </div>
    </main>
  );
}

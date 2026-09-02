export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";

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

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Participants</h1>
        <p className="text-sm text-muted-foreground">People, roles, and authority relationships in the Mighty Verse operational scope.</p>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No participants registered.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Participant</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {participants.map((p) => (
                <tr key={p.participant_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.label ?? <span className="text-muted-foreground italic">void</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {p.role ?? <span className="italic">void</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {p.status ?? <span className="italic">void</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground/50 hidden lg:table-cell">
                    {p.participant_id.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

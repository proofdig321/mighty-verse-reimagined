export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import CreateWorkClient from "./create-work-client";

async function getContext(currentParticipantId: string) {
  const svc = getServiceClient();
  const [{ data: universes }, { data: murals }, { data: allParticipants }] = await Promise.all([
    svc
      .from("master")
      .select("master_id, work_presentation(title)")
      .eq("canonical_type", "universe")
      .not("current_state_id", "is", null)
      .order("created_at", { ascending: false }),
    svc
      .from("master")
      .select("master_id, parent_master_id, work_presentation(title)")
      .eq("canonical_type", "mural")
      .not("current_state_id", "is", null)
      .order("created_at", { ascending: false }),
    svc
      .from("participant")
      .select("participant_id, identity_link(identity_ref, identity_type, active)")
      .eq("status", "active"),
  ]);

  const participants = (allParticipants ?? []).map((p) => {
    const links = Array.isArray(p.identity_link) ? p.identity_link : [];
    // Prefer a non-UUID identity_ref (seed label, email, etc.) over raw UUID
    const label =
      links.find((l: { active: boolean; identity_type: string; identity_ref: string }) => l.active && l.identity_type !== "web2-account")?.identity_ref ??
      links.find((l: { active: boolean; identity_ref: string }) => l.active)?.identity_ref ??
      p.participant_id.slice(0, 8);
    return {
      participant_id: p.participant_id,
      label: p.participant_id === currentParticipantId ? `Me (${label})` : label,
      is_self: p.participant_id === currentParticipantId,
    };
  });

  // Sort: self first
  participants.sort((a, b) => (a.is_self ? -1 : b.is_self ? 1 : 0));

  return {
    universes: (universes ?? []).map((u) => ({
      master_id: u.master_id,
      title: (Array.isArray(u.work_presentation) ? u.work_presentation[0] : u.work_presentation as { title: string } | null)?.title ?? null,
    })),
    murals: (murals ?? []).map((m) => ({
      master_id: m.master_id,
      parent_master_id: m.parent_master_id,
      title: (Array.isArray(m.work_presentation) ? m.work_presentation[0] : m.work_presentation as { title: string } | null)?.title ?? null,
    })),
    participants,
    currentParticipantId,
  };
}

export default async function CreateWorkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const context = await getContext(participantId);

  return (
    <CreateWorkClient
      universes={context.universes}
      murals={context.murals}
      participants={context.participants}
      currentParticipantId={context.currentParticipantId}
    />
  );
}

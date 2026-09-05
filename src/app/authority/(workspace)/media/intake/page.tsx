export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import MediaIntakeClient from "./media-intake-client";

async function getParticipants() {
  const svc = getServiceClient();
  const { data } = await svc
    .from("participant")
    .select("participant_id, identity_link(identity_ref, active)")
    .eq("status", "active");
  return (data ?? []).map((p) => ({
    participant_id: p.participant_id,
    label: Array.isArray(p.identity_link)
      ? (p.identity_link as { active: boolean; identity_ref: string }[]).find((l) => l.active)?.identity_ref ?? p.participant_id.slice(0, 8)
      : p.participant_id.slice(0, 8),
  }));
}

export default async function MediaIntakePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const participants = await getParticipants();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media</p>
        <h1 className="text-3xl font-semibold tracking-tight">Add Media</h1>
        <p className="text-sm text-muted-foreground">
          Register a new media intake record — identity, source, ISRC state, credits, and provenance.
          Upload and media processing happen after the intake record is created.
        </p>
      </div>
      <div className="max-w-2xl">
        <MediaIntakeClient participants={participants} />
      </div>
    </div>
  );
}

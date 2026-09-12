import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadOperationalParticipants } from "@/lib/participants/operational";
import ParticipantsClient from "./participants-client";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const participants = await loadOperationalParticipants();

  return <ParticipantsClient participants={participants} />;
}

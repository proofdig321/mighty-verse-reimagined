import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import AuthorityClient from "./authority-client";

export default async function AuthorityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  return <AuthorityClient />;
}

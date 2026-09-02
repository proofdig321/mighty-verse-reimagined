import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import AuthorityCatalogueClient from "../_shared/authority-catalogue-client";

export default async function PublishingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");
  return <AuthorityCatalogueClient filter="publishing" heading="Publishing" description="Works with an experience or ready for publication." />;
}

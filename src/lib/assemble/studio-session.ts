import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadStudioWorkspace, type StudioWorkspace } from "./load-studio-workspace";

export async function requireStudioWorkspace(
  masterId: string,
  fromCurate = false,
): Promise<StudioWorkspace> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=/authority/universes/${masterId}`);
  if (!(await getParticipantId(supabase))) {
    redirect(`/auth/sign-in?next=/authority/universes/${masterId}`);
  }

  const workspace = await loadStudioWorkspace(masterId, fromCurate);
  if (!workspace) notFound();
  return workspace;
}

export async function requireStudioUser(next = "/studio"): Promise<{ participantId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${next}`);
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect(`/auth/sign-in?next=${next}`);
  return { participantId };
}

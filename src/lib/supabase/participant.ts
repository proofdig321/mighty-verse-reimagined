import type { SupabaseClient } from "@supabase/supabase-js";

export async function getParticipantId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("identity_link")
    .select("participant_id")
    .eq("identity_type", "web2-account")
    .eq("identity_ref", user.id)
    .eq("active", true)
    .single();

  if (error || !data) return null;

  return data.participant_id as string;
}

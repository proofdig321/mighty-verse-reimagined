export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import CreateWorkClient from "./create-work-client";

async function getContext() {
  const svc = getServiceClient();
  const [{ data: universes }, { data: murals }] = await Promise.all([
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
  ]);

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
  };
}

export default async function CreateWorkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const context = await getContext();

  return <CreateWorkClient universes={context.universes} murals={context.murals} />;
}

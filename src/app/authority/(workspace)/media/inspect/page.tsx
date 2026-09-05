export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import MediaInspectClient from "./media-inspect-client";

type CanonicalScene = {
  master_id: string;
  title: string | null;
  start_ms: number | null;
  end_ms: number | null;
};

async function getCanonicalScenes(): Promise<CanonicalScene[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id")
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);

  const [{ data: presentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    svc.from("projection").select("master_id, projection_id").in("master_id", ids).eq("projection_type", "experiential"),
  ]);

  const projIds = (projections ?? []).map((p) => p.projection_id);
  const { data: bindings } = projIds.length
    ? await svc.from("projection_media_binding").select("projection_id, start_ms, end_ms").in("projection_id", projIds).eq("binding_type", "primary")
    : { data: [] };

  return masters.map((m) => {
    const proj = (projections ?? []).find((p) => p.master_id === m.master_id);
    const binding = proj ? (bindings ?? []).find((b) => b.projection_id === proj.projection_id) : null;
    return {
      master_id: m.master_id,
      title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      start_ms: binding?.start_ms ?? null,
      end_ms: binding?.end_ms ?? null,
    };
  });
}

export default async function MediaInspectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const canonicalScenes = await getCanonicalScenes();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media Intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight">Scene Boundary Inspection</h1>
        <p className="text-sm text-muted-foreground">
          Load a video to inspect its temporal structure. The browser samples frames, detects visual changes,
          and proposes candidate boundaries. Compare against existing canonical Scenes.
          Candidates are evidence — the operator decides what becomes canonical.
        </p>
      </div>
      <MediaInspectClient canonicalScenes={canonicalScenes} />
    </div>
  );
}

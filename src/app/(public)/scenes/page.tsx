export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import SceneDeckClient from "@/components/scene-deck-client";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

async function getData(): Promise<SceneItem[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id")
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);

  const [{ data: presentations }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    svc.from("projection").select("master_id, projection_id").in("master_id", ids).eq("projection_type", "experiential"),
  ]);

  return masters.map((m) => ({
    master_id: m.master_id,
    title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
    projection_id: (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id ?? null,
  }));
}

export default async function ScenesPage() {
  const scenes = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/scenes" />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Scene Deck
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shuffle the deck to reveal hidden creative moments. Create your own timeline.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <SceneDeckClient scenes={scenes} />
      </div>
    </main>
  );
}

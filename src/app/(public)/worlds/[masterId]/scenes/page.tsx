export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import SceneDeckClient from "@/components/scene-deck-client";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

async function getData(masterId: string): Promise<{ universeTitle: string | null; scenes: SceneItem[] }> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", masterId)
    .single();
  if (!master || master.canonical_type !== "universe") return { universeTitle: null, scenes: [] };

  const { data: pres } = await svc
    .from("work_presentation")
    .select("title")
    .eq("master_id", masterId)
    .maybeSingle();

  // Scenes live inside murals — find mural children, then their scene children
  const { data: muralMasters } = await svc
    .from("master")
    .select("master_id")
    .eq("parent_master_id", masterId)
    .eq("canonical_type", "mural")
    .not("current_state_id", "is", null);

  const muralIds = (muralMasters ?? []).map((m) => m.master_id);
  if (!muralIds.length) return { universeTitle: pres?.title ?? null, scenes: [] };

  const { data: sceneChildren } = await svc
    .from("master")
    .select("master_id")
    .in("parent_master_id", muralIds)
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: true });

  const sceneIds = (sceneChildren ?? []).map((s) => s.master_id);
  if (!sceneIds.length) return { universeTitle: pres?.title ?? null, scenes: [] };

  const [{ data: scenePres }, { data: sceneProjs }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
    svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
  ]);

  return {
    universeTitle: pres?.title ?? null,
    scenes: sceneIds.map((id) => ({
      master_id: id,
      title: (scenePres ?? []).find((p) => p.master_id === id)?.title ?? null,
      projection_id: (sceneProjs ?? []).find((p) => p.master_id === id)?.projection_id ?? null,
    })),
  };
}

export default async function UniverseScenesPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const { universeTitle, scenes } = await getData(masterId);
  if (universeTitle === null && scenes.length === 0) notFound();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/scenes" />
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="space-y-3">
          <Link
            href={`/worlds/${masterId}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {universeTitle ?? "Universe"}
          </Link>
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Scene Deck
          </h1>
          <p className="text-sm text-muted-foreground">
            Shuffle the deck to reveal hidden creative moments. Create your own timeline.
          </p>
        </div>
        <SceneDeckClient scenes={scenes} />
      </div>
    </main>
  );
}

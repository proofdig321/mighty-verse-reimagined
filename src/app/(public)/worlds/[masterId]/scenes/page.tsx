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
  playback_id: string | null;
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
    .select("master_id, parent_master_id, sort_order")
    .in("parent_master_id", muralIds)
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const sceneIds = (sceneChildren ?? []).map((s) => s.master_id);
  if (!sceneIds.length) return { universeTitle: pres?.title ?? null, scenes: [] };

  // Fetch scene presentations, scene projections, and mural projections in parallel
  const muralProjectionQuery = svc
    .from("projection")
    .select("master_id, projection_id")
    .in("master_id", muralIds)
    .eq("projection_type", "experiential");

  const [{ data: scenePres }, { data: sceneProjs }, { data: muralProjs }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
    svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
    muralProjectionQuery,
  ]);

  // Resolve playback_id: try scene's own binding first, fall back to parent mural's binding
  const allProjectionIds = [
    ...(sceneProjs ?? []).map((p) => p.projection_id),
    ...(muralProjs ?? []).map((p) => p.projection_id),
  ];
  const { data: bindings } = allProjectionIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", allProjectionIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  // Build a map: mural_master_id → playback_id
  const muralPlaybackMap = new Map<string, string>();
  for (const mp of muralProjs ?? []) {
    const assetId = (bindings ?? []).find((b) => b.projection_id === mp.projection_id)?.asset_id;
    const ref = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
    if (ref && !ref.startsWith("seed:placeholder:")) muralPlaybackMap.set(mp.master_id, ref);
  }

  // Build a map: scene_master_id → parent_mural_id (already in sceneChildren)
  const sceneMuralMap = new Map<string, string>();
  for (const sc of sceneChildren ?? []) {
    if (sc.parent_master_id) sceneMuralMap.set(sc.master_id, sc.parent_master_id);
  }

  return {
    universeTitle: pres?.title ?? null,
    scenes: sceneIds.map((id) => ({
      master_id: id,
      title: (scenePres ?? []).find((p) => p.master_id === id)?.title ?? null,
      projection_id: (sceneProjs ?? []).find((p) => p.master_id === id)?.projection_id ?? null,
      playback_id: (() => {
        // Try scene's own binding
        const projId = (sceneProjs ?? []).find((p) => p.master_id === id)?.projection_id;
        const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
        const ref = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
        if (ref && !ref.startsWith("seed:placeholder:")) return ref;
        // Fall back to parent mural's binding
        const muralId = sceneMuralMap.get(id);
        return muralId ? (muralPlaybackMap.get(muralId) ?? null) : null;
      })(),
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
    <div className="min-h-screen bg-background">
      <PageTopNav activePath="/scenes" />
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-6">
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
        <SceneDeckClient scenes={scenes} hideHeader />
      </div>
    </div>
  );
}

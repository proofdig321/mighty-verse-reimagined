export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import SceneDeckClient from "@/components/scene-deck-client";
import { Button } from "@/components/ui/button";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
  playback_id: string | null;
};

async function getData(): Promise<SceneItem[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id, parent_master_id")
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const muralIds = [...new Set(masters.map((m) => m.parent_master_id).filter(Boolean) as string[])];

  const [{ data: presentations }, { data: projections }, { data: muralProjs }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    svc.from("projection").select("master_id, projection_id").in("master_id", ids).eq("projection_type", "experiential"),
    muralIds.length
      ? svc.from("projection").select("master_id, projection_id").in("master_id", muralIds).eq("projection_type", "experiential")
      : Promise.resolve({ data: [] }),
  ]);

  const allProjIds = [
    ...(projections ?? []).map((p) => p.projection_id),
    ...(muralProjs ?? []).map((p) => p.projection_id),
  ];
  const { data: bindings } = allProjIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", allProjIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  const muralPlaybackMap = new Map<string, string>();
  for (const mp of muralProjs ?? []) {
    const assetId = (bindings ?? []).find((b) => b.projection_id === mp.projection_id)?.asset_id;
    const ref = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
    if (ref && !ref.startsWith("seed:placeholder:")) muralPlaybackMap.set(mp.master_id, ref);
  }

  return masters.map((m) => {
    const projId = (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id;
    const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
    const ownRef = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
    const playback_id =
      ownRef && !ownRef.startsWith("seed:placeholder:")
        ? ownRef
        : m.parent_master_id
        ? (muralPlaybackMap.get(m.parent_master_id) ?? null)
        : null;
    return {
      master_id: m.master_id,
      title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      projection_id: projId ?? null,
      playback_id,
    };
  });
}

export default async function ScenesPage() {
  const scenes = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/scenes" />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-1" style={{ color: "var(--accent-mv)" }}>Children of the Mural</p>
            <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display, inherit)" }}>Scene Deck</h1>
            <p className="text-sm text-muted-foreground mt-1">Shuffle the deck to reveal hidden creative moments. Create your own timeline.</p>
          </div>
          <Link href="/editor" className="shrink-0 mt-1">
            <Button variant="outline" size="sm">Build Experience →</Button>
          </Link>
        </div>
        <SceneDeckClient scenes={scenes} faceDownUntilSelected label="From the Mural" hideHeader />
      </div>
    </div>
  );
}

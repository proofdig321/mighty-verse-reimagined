export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import SceneStack from "@/components/scene-stack";

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

  const projectionIds = (projections ?? []).map((p) => p.projection_id);
  const { data: bindings } = projectionIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", projectionIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  return masters.map((m) => ({
    master_id: m.master_id,
    title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
    projection_id: (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id ?? null,
    playback_id: (() => {
      const projId = (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id;
      const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
      const ref = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
      return ref && !ref.startsWith("seed:placeholder:") ? ref : null;
    })(),
  }));
}

export default async function ScenesPage() {
  const scenes = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/scenes" />
      <SceneStack
        scenes={scenes.map((s) => ({
          id: s.master_id,
          title: s.title,
          href: s.projection_id ? `/moments/${s.projection_id}` : undefined,
          playbackId: s.playback_id,
        }))}
      />
    </div>
  );
}

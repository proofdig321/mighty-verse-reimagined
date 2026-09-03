export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import SceneDeckClient from "@/components/scene-deck-client";

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

    const projectionIds = (projections ?? []).map((projection) => projection.projection_id);
    const { data: bindings } = projectionIds.length
      ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", projectionIds).eq("binding_type", "primary").eq("access_level", "public")
      : { data: [] };
    const assetIds = (bindings ?? []).map((binding) => binding.asset_id);
    const { data: assets } = assetIds.length
      ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
      : { data: [] };

  return masters.map((m) => ({
    master_id: m.master_id,
    title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
    projection_id: (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id ?? null,
    playback_id: (() => {
      const projectionId = (projections ?? []).find((projection) => projection.master_id === m.master_id)?.projection_id;
      const assetId = (bindings ?? []).find((binding) => binding.projection_id === projectionId)?.asset_id;
      const storageRef = (assets ?? []).find((asset) => asset.asset_id === assetId)?.storage_ref;
      return storageRef && !storageRef.startsWith("seed:placeholder:") ? storageRef : null;
    })(),
  }));
}

export default async function ScenesPage() {
  const scenes = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/scenes" />
      <div className="public-hero">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-mv">Sequence and discovery</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Scene Deck
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shuffle the deck to reveal hidden creative moments. Create your own timeline.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <SceneDeckClient scenes={scenes} />
      </div>
    </div>
  );
}

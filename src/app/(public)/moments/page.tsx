export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import MomentsFilterClient from "@/components/moments-filter-client";

type MomentItem = {
  projection_id: string;
  title: string | null;
  projection_type: string;
  collectible_designated: boolean;
  has_media: boolean;
};

async function getData(): Promise<MomentItem[]> {
  const svc = getServiceClient();

  const { data: projections } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, master_id")
    .order("created_at", { ascending: false });

  if (!projections?.length) return [];

  const ids = projections.map((p) => p.projection_id);

  const [{ data: presentations }, { data: workPresentations }, { data: bindings }] = await Promise.all([
    svc.from("projection_presentation").select("projection_id, title").in("projection_id", ids),
    svc.from("work_presentation").select("master_id, title").in("master_id", projections.map(p => p.master_id)),
    svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", ids).eq("access_level", "public"),
  ]);

  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  const placeholderSet = new Set(
    (assets ?? []).filter((a) => a.storage_ref?.startsWith("seed:placeholder:")).map((a) => a.asset_id)
  );

  const hasMediaMap = new Map<string, boolean>();
  for (const b of bindings ?? []) {
    if (!hasMediaMap.has(b.projection_id)) {
      hasMediaMap.set(b.projection_id, !placeholderSet.has(b.asset_id));
    }
  }

  return projections.map((p) => ({
    projection_id: p.projection_id,
    title: (presentations ?? []).find((pp) => pp.projection_id === p.projection_id)?.title
        ?? (workPresentations ?? []).find((wp) => wp.master_id === p.master_id)?.title
        ?? null,
    projection_type: p.projection_type,
    collectible_designated: p.collectible_designated,
    has_media: hasMediaMap.get(p.projection_id) ?? false,
  }));
}

export default async function MomentsPage() {
  const moments = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/moments" />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
            All Moments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and collect creative moments from across all universes.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <MomentsFilterClient moments={moments} />
      </div>
    </main>
  );
}

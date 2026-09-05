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
  playback_id: string | null;
  canonical_type: string | null;
  context_title: string | null;
  context_type: string | null;
  context_href: string | null;
};

async function getData(): Promise<MomentItem[]> {
  const svc = getServiceClient();

  const { data: projections } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, master_id")
    .order("created_at", { ascending: false });

  if (!projections?.length) return [];

  const ids = projections.map((p) => p.projection_id);
  const masterIds = projections.map((p) => p.master_id);

  const [{ data: presentations }, { data: workPresentations }, { data: bindings }, { data: masters }] = await Promise.all([
    svc.from("projection_presentation").select("projection_id, title").in("projection_id", ids),
    svc.from("work_presentation").select("master_id, title").in("master_id", masterIds),
    svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", ids).eq("access_level", "public"),
    masterIds.length ? svc.from("master").select("master_id, canonical_type, parent_master_id").in("master_id", masterIds) : Promise.resolve({ data: [] }),
  ]);

  const parentIds = (masters ?? []).map((m) => m.parent_master_id).filter(Boolean);
  const [{ data: parentMasters }, { data: parentPresentations }] = parentIds.length
    ? await Promise.all([
        svc.from("master").select("master_id, canonical_type").in("master_id", parentIds),
        svc.from("work_presentation").select("master_id, title").in("master_id", parentIds),
      ])
    : [{ data: [] }, { data: [] }];

  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", assetIds)
    : { data: [] };

  const placeholderSet = new Set(
    (assets ?? []).filter((a) => a.storage_ref?.startsWith("seed:placeholder:")).map((a) => a.asset_id)
  );
  const playbackMap = new Map<string, string>();
  for (const b of bindings ?? []) {
    const ref = (assets ?? []).find((a) => a.asset_id === b.asset_id)?.storage_ref;
    if (ref && !ref.startsWith("seed:placeholder:")) playbackMap.set(b.projection_id, ref);
  }
  const hasMediaMap = new Map<string, boolean>();
  for (const b of bindings ?? []) {
    if (!hasMediaMap.has(b.projection_id)) hasMediaMap.set(b.projection_id, !placeholderSet.has(b.asset_id));
  }

  return projections.map((p) => ({
    projection_id: p.projection_id,
    title: (presentations ?? []).find((pp) => pp.projection_id === p.projection_id)?.title
        ?? (workPresentations ?? []).find((wp) => wp.master_id === p.master_id)?.title
        ?? null,
    projection_type: p.projection_type,
    collectible_designated: p.collectible_designated,
    has_media: hasMediaMap.get(p.projection_id) ?? false,
    playback_id: playbackMap.get(p.projection_id) ?? null,
    canonical_type: (masters ?? []).find((m) => m.master_id === p.master_id)?.canonical_type ?? null,
    context_title: (() => {
      const parentId = (masters ?? []).find((m) => m.master_id === p.master_id)?.parent_master_id;
      return (parentPresentations ?? []).find((pp) => pp.master_id === parentId)?.title ?? null;
    })(),
    context_type: (() => {
      const parentId = (masters ?? []).find((m) => m.master_id === p.master_id)?.parent_master_id;
      return (parentMasters ?? []).find((pm) => pm.master_id === parentId)?.canonical_type ?? null;
    })(),
    context_href: (() => {
      const parentId = (masters ?? []).find((m) => m.master_id === p.master_id)?.parent_master_id;
      return parentId ? `/worlds/${parentId}` : null;
    })(),
  }));
}

export default async function MomentsPage() {
  const moments = await getData();
  return (
    <div className="public-page">
      <PageTopNav activePath="/moments" />
      <MomentsFilterClient moments={moments} />
    </div>
  );
}

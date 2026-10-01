export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import GalleryFilterClient from "@/components/gallery-filter-client";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
  storage_ref: string | null;
  provider: string | null;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  work_title: string | null;
};

async function getData(): Promise<MediaItem[]> {
  const svc = getServiceClient();

  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("asset_id, projection_id")
    .eq("access_level", "public");

  if (!bindings?.length) return [];

  const assetIds = [...new Set(bindings.map((b) => b.asset_id))];

  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, provider, rights_holder_ref, rights_basis, intake_id")
    .in("asset_id", assetIds)
    .not("storage_ref", "like", "seed:placeholder:%");

  if (!assets?.length) return [];

  // Load intake titles for assets that have them
  const intakeIds = [...new Set(assets.map((a) => a.intake_id).filter(Boolean))] as string[];
  const { data: intakes } = intakeIds.length
    ? await svc.from("media_intake").select("intake_id, title, work_type").in("intake_id", intakeIds)
    : { data: [] };
  const intakeMap = new Map((intakes ?? []).map((i) => [i.intake_id, i]));

  // Load Universe titles via projection chain for work_title
  const projIds = [...new Set(bindings.map((b) => b.projection_id))];
  const { data: projections } = await svc
    .from("projection")
    .select("projection_id, master_id")
    .in("projection_id", projIds);
  const masterIds = [...new Set((projections ?? []).map((p) => p.master_id))];
  const { data: presentations } = masterIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", masterIds)
    : { data: [] };
  const presentationMap = new Map((presentations ?? []).map((p) => [p.master_id, p.title]));
  // asset_id → universe title
  const assetUniverseTitle = new Map<string, string>();
  for (const binding of bindings) {
    const proj = (projections ?? []).find((p) => p.projection_id === binding.projection_id);
    if (proj) {
      const title = presentationMap.get(proj.master_id);
      if (title) assetUniverseTitle.set(binding.asset_id, title);
    }
  }

  return assets.map((a) => {
    const intake = a.intake_id ? intakeMap.get(a.intake_id) : null;
    return {
      asset_id: a.asset_id,
      asset_type: a.asset_type ?? null,
      title: intake?.title ?? null,
      storage_ref: a.storage_ref ?? null,
      provider: a.provider ?? null,
      rights_holder_ref: a.rights_holder_ref ?? null,
      rights_basis: a.rights_basis ?? null,
      work_title: assetUniverseTitle.get(a.asset_id) ?? null,
    };
  });
}

export default async function GalleryPage() {
  const items = await getData();
  return (
    <div className="public-page">
      <GalleryFilterClient items={items} />
    </div>
  );
}

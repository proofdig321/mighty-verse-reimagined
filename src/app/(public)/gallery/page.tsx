export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import GalleryFilterClient from "@/components/gallery-filter-client";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
  storage_ref: string | null;
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
    .select("asset_id, asset_type, storage_ref")
    .in("asset_id", assetIds)
    .not("storage_ref", "like", "seed:placeholder:%");

  return (assets ?? []).map((a) => ({
    asset_id: a.asset_id,
    asset_type: a.asset_type ?? null,
    title: null,
    storage_ref: a.storage_ref ?? null,
    rights_holder_ref: null,
    rights_basis: null,
    work_title: null,
  }));
}

export default async function GalleryPage() {
  const items = await getData();
  return (
    <div className="public-page">
      <PageTopNav activePath="/gallery" />
      <GalleryFilterClient items={items} />
    </div>
  );
}

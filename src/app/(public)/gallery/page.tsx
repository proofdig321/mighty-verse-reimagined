export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import GalleryFilterClient from "@/components/gallery-filter-client";
import { Button } from "@/components/ui/button";

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
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/gallery" />
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        <div>
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Media Gallery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Images, videos, audio and documents from across the universes.
          </p>
        </div>
        <GalleryFilterClient items={items} />
        <div className="pt-2">
          <Button variant="outline">View Full Gallery</Button>
        </div>
      </div>
    </main>
  );
}

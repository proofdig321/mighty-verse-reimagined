export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import GalleryFilterClient from "@/components/gallery-filter-client";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
};

async function getData(): Promise<MediaItem[]> {
  const svc = getServiceClient();

  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("asset_id");

  if (!bindings?.length) return [];

  const assetIds = [...new Set(bindings.map((b) => b.asset_id))];

  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, title")
    .in("asset_id", assetIds)
    .not("storage_ref", "like", "seed:placeholder:%");

  return (assets ?? []).map((a) => ({
    asset_id: a.asset_id,
    asset_type: a.asset_type ?? null,
    title: a.title ?? null,
  }));
}

export default async function MediaGalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const items = await getData();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Media Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Audio and video assets bound to projections across the operational scope.
          {items.length > 0 && <span className="ml-2 text-muted-foreground/60">{items.length} asset{items.length !== 1 ? "s" : ""}</span>}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media assets found in the operational scope.</p>
      ) : (
        <GalleryFilterClient items={items} />
      )}
    </div>
  );
}

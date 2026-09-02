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
  // storage_ref = Livepeer asset ID — used as playbackId for poster/playback
  storage_ref: string | null;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  work_title: string | null;
};

async function getData(): Promise<MediaItem[]> {
  const svc = getServiceClient();

  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("asset_id, projection_id");

  if (!bindings?.length) return [];

  const assetIds = [...new Set(bindings.map((b) => b.asset_id))];

  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, rights_holder_ref, rights_basis")
    .in("asset_id", assetIds)
    .not("storage_ref", "like", "seed:placeholder:%");

  if (!assets?.length) return [];

  // Fetch work titles via projection_presentation
  const projIds = [...new Set(bindings.map((b) => b.projection_id).filter(Boolean))];
  const { data: presentations } = projIds.length
    ? await svc.from("projection_presentation").select("projection_id, title").in("projection_id", projIds)
    : { data: [] };

  // Build asset_id → work_title map via bindings
  const assetToWorkTitle = new Map<string, string>();
  for (const b of bindings) {
    const pres = (presentations ?? []).find((p) => p.projection_id === b.projection_id);
    if (pres?.title) assetToWorkTitle.set(b.asset_id, pres.title);
  }

  return assets.map((a) => ({
    asset_id: a.asset_id,
    asset_type: a.asset_type ?? null,
    title: null,
    storage_ref: a.storage_ref ?? null,
    rights_holder_ref: a.rights_holder_ref ?? null,
    rights_basis: a.rights_basis ?? null,
    work_title: assetToWorkTitle.get(a.asset_id) ?? null,
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

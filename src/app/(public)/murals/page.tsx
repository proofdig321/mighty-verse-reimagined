export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";

type MuralItem = {
  master_id: string;
  title: string | null;
  artist: string | null;
  playback_id: string | null;
};

async function getData(): Promise<MuralItem[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id, attribution_ref")
    .eq("canonical_type", "mural")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const attrIds = masters.map((m) => m.attribution_ref).filter(Boolean);

  const [{ data: presentations }, { data: attrEntries }, { data: projections }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    attrIds.length
      ? svc.from("attribution_entry").select("attribution_id, role_type").in("attribution_id", attrIds).eq("public", true)
      : Promise.resolve({ data: [] }),
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
    artist: (attrEntries ?? []).find((e) => e.attribution_id === m.attribution_ref)?.role_type?.replace(/-/g, " ") ?? null,
    playback_id: (() => {
      const projectionId = (projections ?? []).find((projection) => projection.master_id === m.master_id)?.projection_id;
      const assetId = (bindings ?? []).find((binding) => binding.projection_id === projectionId)?.asset_id;
      const storageRef = (assets ?? []).find((asset) => asset.asset_id === assetId)?.storage_ref;
      return storageRef && !storageRef.startsWith("seed:placeholder:") ? storageRef : null;
    })(),
  }));
}

export default async function MuralsPage() {
  const murals = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/murals" />
      <div className="public-hero">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent-mv">Visual expressions of Worlds</p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Mural Gallery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Explore all animated murals.</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        {murals.length > 0 ? (
          <div className="artifact-grid">
            {murals.map((m) => (
              <Link key={m.master_id} href={`/worlds/${m.master_id}`} className="artifact-card group">
                {m.playback_id ? <MediaVisual playbackId={m.playback_id} title={m.title ?? "Mural"} /> : <ArtworkFrame artworkUrl={null} alt={m.title ?? ""} aspectRatio="16/9" />}
                <div className="artifact-copy">
                  <p className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity" style={{ fontFamily: "var(--font-display, inherit)" }}>
                    {m.title ?? "Untitled"}
                  </p>
                  {m.artist && <p className="text-xs text-muted-foreground truncate capitalize">{m.artist}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No murals yet.</p>
        )}
      </div>
    </div>
  );
}

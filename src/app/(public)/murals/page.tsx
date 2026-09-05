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
  provider: string | null;
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

  const projectionIds = (projections ?? []).map((p) => p.projection_id);
  const { data: bindings } = projectionIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", projectionIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref, provider").in("asset_id", assetIds)
    : { data: [] };

  return masters.map((m) => ({
    master_id: m.master_id,
    title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
    artist: (attrEntries ?? []).find((e) => e.attribution_id === m.attribution_ref)?.role_type?.replace(/-/g, " ") ?? null,
    playback_id: (() => {
      const projId = (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id;
      const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
      const ref = (assets ?? []).find((a) => a.asset_id === assetId)?.storage_ref;
      return ref && !ref.startsWith("seed:placeholder:") ? ref : null;
    })(),
    provider: (() => {
      const projId = (projections ?? []).find((p) => p.master_id === m.master_id)?.projection_id;
      const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
      return (assets ?? []).find((a) => a.asset_id === assetId)?.provider ?? null;
    })(),
  }));
}

export default async function MuralsPage() {
  const murals = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/murals" />

      {/* Header band — heading left, controls right */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              Visual expressions of Worlds
            </p>
            <h1
              className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Mural Gallery
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Explore all animated murals.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
              defaultValue=""
            >
              <option value="">All Genres</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
              defaultValue="recent"
            >
              <option value="recent">Most Recent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {murals.length > 0 ? (
          <div className="artifact-grid-wide">
            {murals.map((m) => (
              <Link key={m.master_id} href={`/worlds/${m.master_id}`} className="artifact-card group">
                {m.playback_id ? (
                  <MediaVisual playbackId={m.playback_id} provider={m.provider} title={m.title ?? "Mural"} aspectRatio="16/9" />
                ) : (
                  <ArtworkFrame artworkUrl={null} alt={m.title ?? ""} aspectRatio="16/9" />
                )}
                <div className="artifact-copy">
                  <p
                    className="text-base font-semibold text-foreground truncate group-hover:opacity-80 transition-opacity"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    {m.title ?? "Untitled"}
                  </p>
                  {m.artist && (
                    <p className="mt-1 text-xs text-muted-foreground truncate capitalize">{m.artist}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Mural Scene</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No murals yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

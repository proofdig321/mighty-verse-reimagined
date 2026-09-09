export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import { sceneShortTitle } from "@/lib/assemble/composition";
import PageTopNav from "@/components/page-top-nav";
import ArtworkFrame from "@/components/artwork-frame";
import MediaVisual from "@/components/media-visual";

type CreativeMomentItem = {
  master_id: string;
  title: string | null;
  universe_id: string | null;
  universe_title: string | null;
  scene_titles: string[];
  playback_id: string | null;
  provider: string | null;
};

async function getData(): Promise<CreativeMomentItem[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id, parent_master_id")
    .eq("canonical_type", "creative-moment")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: true });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const universeIds = [...new Set(masters.map((m) => m.parent_master_id).filter(Boolean) as string[])];

  const [{ data: presentations }, { data: universePres }, { data: relations }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    universeIds.length
      ? svc.from("work_presentation").select("master_id, title").in("master_id", universeIds)
      : Promise.resolve({ data: [] }),
    svc.from("scene_moment").select("moment_master_id, scene_master_id, sort_order").in("moment_master_id", ids).eq("relationship_type", "primary"),
  ]);

  const sceneIds = [...new Set((relations ?? []).map((row) => row.scene_master_id))];
  const { data: scenePres } = sceneIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds)
    : { data: [] };

  const { data: murals } = universeIds.length
    ? await svc.from("master").select("master_id, parent_master_id").in("parent_master_id", universeIds).eq("canonical_type", "mural")
    : { data: [] };
  const muralIds = (murals ?? []).map((m) => m.master_id);
  const { data: muralProjs } = muralIds.length
    ? await svc.from("projection").select("master_id, projection_id").in("master_id", muralIds).eq("projection_type", "experiential")
    : { data: [] };
  const muralProjIds = (muralProjs ?? []).map((p) => p.projection_id);
  const { data: bindings } = muralProjIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", muralProjIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref, provider").in("asset_id", assetIds)
    : { data: [] };

  const muralPlaybackByUniverse = new Map<string, { playback_id: string; provider: string | null }>();
  for (const mural of murals ?? []) {
    if (!mural.parent_master_id) continue;
    const projId = (muralProjs ?? []).find((p) => p.master_id === mural.master_id)?.projection_id;
    const assetId = (bindings ?? []).find((b) => b.projection_id === projId)?.asset_id;
    const asset = (assets ?? []).find((a) => a.asset_id === assetId);
    const ref = asset?.storage_ref;
    if (ref && !ref.startsWith("seed:placeholder:")) {
      muralPlaybackByUniverse.set(mural.parent_master_id, { playback_id: ref, provider: asset?.provider ?? null });
    }
  }

  return masters.map((m) => {
    const relatedSceneIds = (relations ?? [])
      .filter((row) => row.moment_master_id === m.master_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((row) => row.scene_master_id);
    const media = m.parent_master_id ? muralPlaybackByUniverse.get(m.parent_master_id) ?? null : null;
    return {
      master_id: m.master_id,
      title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      universe_id: m.parent_master_id ?? null,
      universe_title: m.parent_master_id
        ? (universePres ?? []).find((p) => p.master_id === m.parent_master_id)?.title ?? null
        : null,
      scene_titles: relatedSceneIds.map((id) => {
        const title = (scenePres ?? []).find((p) => p.master_id === id)?.title ?? null;
        return sceneShortTitle(title) ?? title ?? "Scene";
      }),
      playback_id: media?.playback_id ?? null,
      provider: media?.provider ?? null,
    };
  });
}

export default async function MomentsPage() {
  const moments = await getData();

  return (
    <div className="public-page">
      <PageTopNav activePath="/moments" />

      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">Reveal</p>
          <h1
            className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Creative Moments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Contributor identities in a Universe. Open a Creative Moment, then continue into Experience.
            A Creative Moment is not a Scene and not a Moment Card.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {moments.length > 0 ? (
          <div className="artifact-grid-wide">
            {moments.map((moment) => (
              <Link
                key={moment.master_id}
                href={`/creative-moments/${moment.master_id}`}
                className="artifact-card group"
                data-moment-id={moment.master_id}
              >
                {moment.playback_id ? (
                  <MediaVisual
                    playbackId={moment.playback_id}
                    provider={moment.provider}
                    title={moment.title ?? "Creative Moment"}
                    aspectRatio="16/9"
                  />
                ) : (
                  <ArtworkFrame artworkUrl={null} alt={moment.title ?? ""} aspectRatio="16/9" />
                )}
                <div className="artifact-copy">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Creative Moment
                  </p>
                  <p
                    className="mt-1 text-base font-semibold text-foreground truncate group-hover:opacity-80 transition-opacity"
                    style={{ fontFamily: "var(--font-display, inherit)" }}
                  >
                    {moment.title ?? "Untitled"}
                  </p>
                  {moment.universe_title ? (
                    <p className="mt-1 text-xs text-muted-foreground truncate">{moment.universe_title}</p>
                  ) : null}
                  {moment.scene_titles.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      Present in {moment.scene_titles.join(" and ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No Creative Moments yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

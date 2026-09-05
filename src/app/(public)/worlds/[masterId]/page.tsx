import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MediaHero from "@/components/media-hero";
import WorldTabsClient from "@/components/world-tabs-client";
import PageTopNav from "@/components/page-top-nav";

type MuralRow = { master_id: string; title: string | null; projection_id: string | null };
type MomentRow = { master_id: string; title: string | null; projection_id: string | null };
type SceneRow = { master_id: string; title: string | null; projection_id: string | null; playback_id: string | null; start_ms: number | null; end_ms: number | null };

type PageData = {
  canonical_type: string;
  master_id: string;
  title: string | null;
  description: string | null;
  attribution_roles: string[];
  media: ProjectionMedia | null;
  projection_id: string | null;
  canonical_state_id: string | null;
  murals: MuralRow[];
  moments: MomentRow[];
  scenes: SceneRow[];
  universe_master_id: string | null;
  universe_title: string | null;
};

async function resolveMedia(svc: ReturnType<typeof getServiceClient>, projectionId: string): Promise<ProjectionMedia | null> {
  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id, start_ms, end_ms")
    .eq("projection_id", projectionId)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();
  if (!binding) return null;
  const [{ data: asset }, { data: variant }] = await Promise.all([
    svc.from("media_asset").select("storage_ref").eq("asset_id", binding.asset_id).single(),
    svc.from("delivery_variant").select("delivery_format").eq("asset_id", binding.asset_id).single(),
  ]);
  const isPlaceholder = asset?.storage_ref?.startsWith("seed:placeholder:") ?? true;
  return {
    binding_type: binding.binding_type,
    access_level: binding.access_level,
    delivery_format: variant?.delivery_format ?? "hls",
    playback_id: isPlaceholder ? null : (asset?.storage_ref ?? null),
    is_placeholder: isPlaceholder,
    start_ms: binding.start_ms ?? null,
    end_ms: binding.end_ms ?? null,
  };
}

async function getPageData(masterId: string): Promise<PageData | null> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, parent_master_id, attribution_ref")
    .eq("master_id", masterId)
    .single();
  if (!master) return null;
  if (master.canonical_type !== "universe" && master.canonical_type !== "mural") return null;

  const { data: cs } = await svc
    .from("canonical_state")
    .select("canonical_state_id, authorisation_state")
    .eq("canonical_state_id", master.current_state_id)
    .eq("authorisation_state", "authorised")
    .single();
  if (!cs) return null;

  const [{ data: proj }, { data: pres }, { data: attrEntries }] = await Promise.all([
    svc.from("projection").select("projection_id").eq("canonical_state_id", cs.canonical_state_id).eq("projection_type", "experiential").single(),
    svc.from("work_presentation").select("title, description").eq("master_id", masterId).maybeSingle(),
    master.attribution_ref
      ? svc.from("attribution_entry").select("role_type").eq("attribution_id", master.attribution_ref).eq("public", true)
      : Promise.resolve({ data: [] }),
  ]);

  const attributionRoles = (attrEntries ?? []).map((e) => e.role_type);
  const media = proj ? await resolveMedia(svc, proj.projection_id) : null;

  if (master.canonical_type === "universe") {
    const { data: muralMasters } = await svc
      .from("master")
      .select("master_id")
      .eq("parent_master_id", masterId)
      .eq("canonical_type", "mural")
      .not("current_state_id", "is", null);
    const muralIds = (muralMasters ?? []).map((m) => m.master_id);

    const [{ data: muralPres }, { data: muralProjs }] = muralIds.length
      ? await Promise.all([
          svc.from("work_presentation").select("master_id, title").in("master_id", muralIds),
          svc.from("projection").select("master_id, projection_id").in("master_id", muralIds).eq("projection_type", "experiential"),
        ])
      : [{ data: [] }, { data: [] }];

    const murals: MuralRow[] = (muralMasters ?? []).map((m) => ({
      master_id: m.master_id,
      title: (muralPres ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      projection_id: (muralProjs ?? []).find((p) => p.master_id === m.master_id)?.projection_id ?? null,
    }));

    const { data: cmMasters } = await svc
      .from("master")
      .select("master_id")
      .eq("parent_master_id", masterId)
      .eq("canonical_type", "creative-moment")
      .not("current_state_id", "is", null);
    const cmIds = (cmMasters ?? []).map((m) => m.master_id);
    const [{ data: cmPres }, { data: cmProjs }] = cmIds.length
      ? await Promise.all([
          svc.from("work_presentation").select("master_id, title").in("master_id", cmIds),
          svc.from("projection").select("master_id, projection_id").in("master_id", cmIds),
        ])
      : [{ data: [] }, { data: [] }];

    const moments: MomentRow[] = (cmMasters ?? []).map((m) => ({
      master_id: m.master_id,
      title: (cmPres ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      projection_id: (cmProjs ?? []).find((projection) => projection.master_id === m.master_id)?.projection_id ?? null,
    }));

    return {
      canonical_type: "universe",
      master_id: masterId,
      title: pres?.title ?? null,
      description: pres?.description ?? null,
      attribution_roles: attributionRoles,
      media,
      projection_id: proj?.projection_id ?? null,
      canonical_state_id: cs.canonical_state_id,
      murals,
      moments,
      scenes: [],
      universe_master_id: null,
      universe_title: null,
    };
  }

  // Mural — Scenes ordered by canonical sort_order, then created_at
  const { data: sceneChildren } = await svc
    .from("master")
    .select("master_id, sort_order")
    .eq("parent_master_id", masterId)
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const sceneIds = (sceneChildren ?? []).map((s) => s.master_id);
  const [{ data: scenePres }, { data: sceneProjs }] = sceneIds.length
    ? await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
        svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
      ])
    : [{ data: [] }, { data: [] }];

  const sceneProjectionIds = (sceneProjs ?? []).map((projection) => projection.projection_id);
  const { data: sceneBindings } = sceneProjectionIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id, start_ms, end_ms").in("projection_id", sceneProjectionIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const sceneAssetIds = (sceneBindings ?? []).map((binding) => binding.asset_id);
  const { data: sceneAssets } = sceneAssetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref").in("asset_id", sceneAssetIds)
    : { data: [] };

  const scenes: SceneRow[] = (sceneChildren ?? []).map((s) => ({
    master_id: s.master_id,
    title: (scenePres ?? []).find((p) => p.master_id === s.master_id)?.title ?? null,
    projection_id: (sceneProjs ?? []).find((p) => p.master_id === s.master_id)?.projection_id ?? null,
    playback_id: (() => {
      const projectionId = (sceneProjs ?? []).find((projection) => projection.master_id === s.master_id)?.projection_id;
      const binding = (sceneBindings ?? []).find((item) => item.projection_id === projectionId);
      return (sceneAssets ?? []).find((asset) => asset.asset_id === binding?.asset_id)?.storage_ref ?? null;
    })(),
    start_ms: (() => {
      const projectionId = (sceneProjs ?? []).find((projection) => projection.master_id === s.master_id)?.projection_id;
      return (sceneBindings ?? []).find((item) => item.projection_id === projectionId)?.start_ms ?? null;
    })(),
    end_ms: (() => {
      const projectionId = (sceneProjs ?? []).find((projection) => projection.master_id === s.master_id)?.projection_id;
      return (sceneBindings ?? []).find((item) => item.projection_id === projectionId)?.end_ms ?? null;
    })(),
  }));

  let universe_master_id: string | null = null;
  let universe_title: string | null = null;
  if (master.parent_master_id) {
    universe_master_id = master.parent_master_id;
    const { data: uPres } = await svc.from("work_presentation").select("title").eq("master_id", master.parent_master_id).maybeSingle();
    universe_title = uPres?.title ?? null;
  }

  return {
    canonical_type: "mural",
    master_id: masterId,
    title: pres?.title ?? null,
    description: pres?.description ?? null,
    attribution_roles: attributionRoles,
    media,
    projection_id: proj?.projection_id ?? null,
    canonical_state_id: cs.canonical_state_id,
    murals: [],
    moments: [],
    scenes,
    universe_master_id,
    universe_title,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const svc = getServiceClient();
  const { data: pres } = await svc.from("work_presentation").select("title, description").eq("master_id", masterId).maybeSingle();
  const title = pres?.title ? `${pres.title} — Mighty Verse` : "Mighty Verse";
  const description = pres?.description ?? "Mighty Verse";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } };
}

export default async function WorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const data = await getPageData(masterId);
  if (!data) notFound();

  const title = data.title ?? (data.canonical_type === "mural" ? "Mural" : "Universe");

  // ── MURAL LAYOUT — Section 06 ─────────────────────────────────────────────
  if (data.canonical_type === "mural") {
    return (
      <div className="min-h-screen bg-background">
        <PageTopNav activePath="/murals" />

        {/* Breadcrumb */}
        {data.universe_master_id && (
          <div className="border-b border-border/50 bg-card/20">
            <div className="mx-auto max-w-7xl px-6 py-3">
              <Link
                href={`/worlds/${data.universe_master_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>←</span>
                <span>{data.universe_title ?? "Universe"}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Mural identity header */}
        <div className="mv-hero-gradient border-b border-border">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="space-y-1">
              {data.universe_title && (
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  {data.universe_title}
                </p>
              )}
              <h1
                className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>
              {data.description && (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                  {data.description.length > 160 ? data.description.slice(0, 160).trimEnd() + "…" : data.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Two-column: player + scene sidebar */}
        <div className="flex flex-col lg:flex-row lg:items-start">

          {/* Left: player — takes natural video height */}
          <div className="flex-1 min-w-0 bg-black">
            <MediaHero
              media={data.media}
              projectionId={data.projection_id ?? ""}
              masterId={data.master_id}
              canonicalStateId={data.canonical_state_id ?? ""}
              title={`${data.universe_title ? `${data.universe_title} — ` : ""}${title}`}
              typeLabel="Mural"
              credit={data.description}
              collectible={false}
              timelineScenes={data.scenes
                .filter((scene) => scene.playback_id === data.media?.playback_id && scene.start_ms != null && scene.end_ms != null)
                .map((scene) => ({ id: scene.master_id, title: scene.title, startMs: scene.start_ms!, endMs: scene.end_ms! }))}
              deckScenes={[]}
            />
          </div>

          {/* Right: scene list sidebar — sticky beside the video */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card/50 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto scrollbar-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Scenes</p>
              <p className="text-xs text-foreground font-medium mt-0.5">{data.scenes.length} total</p>
            </div>
            <div className="divide-y divide-border">
              {data.scenes.length > 0 ? (
                data.scenes.map((s, i) => (
                  <Link
                    key={s.master_id}
                    href={s.projection_id ? `/moments/${s.projection_id}` : "#"}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/50 transition-colors group"
                  >
                    <span
                      className="text-xs font-mono w-5 shrink-0 pt-0.5"
                      style={{ color: "var(--accent-mv)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-foreground group-hover:opacity-80 transition-opacity">
                      {s.title ?? `Scene ${i + 1}`}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="px-5 py-4 text-sm text-muted-foreground">No scenes yet.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border">
              <Link href={`/worlds/${data.universe_master_id}/scenes`}>
                <Button variant="outline" className="w-full text-xs h-9">View Scene Deck</Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── UNIVERSE LAYOUT — Section 03 ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <PageTopNav />

      {/* Hero — media player or identity block */}
      {data.media?.playback_id && data.projection_id && data.canonical_state_id ? (
        <div className="border-b border-border">
          <MediaHero
            media={data.media}
            projectionId={data.projection_id}
            masterId={data.master_id}
            canonicalStateId={data.canonical_state_id}
            title={title}
            typeLabel="Universe"
            credit={data.description}
            collectible={false}
          />
        </div>
      ) : (
        <div className="mv-hero-gradient border-b border-border">
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">Universe</p>
                <h1
                  className="text-5xl font-semibold leading-tight tracking-tight text-foreground md:text-7xl"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {title}
                </h1>
                {data.description && (
                  <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
                    {data.description.length > 160 ? data.description.slice(0, 160).trimEnd() + "\u2026" : data.description}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="shrink-0 mt-1 text-sm px-3 py-1">Universe</Badge>
            </div>
          </div>
        </div>
      )}

      {/* Stats + CTAs */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-6">
              {[
                { n: data.murals.length || "—", label: "Murals" },
                { n: data.moments.length || "—", label: "Moments" },
                { n: "—", label: "Collectibles" },
                { n: "—", label: "Holders" },
              ].map(({ n, label }) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>{n}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
              ))}
              <span
                className="text-xs px-2.5 py-1 rounded-full border font-medium"
                style={{ color: "var(--accent-mv)", borderColor: "color-mix(in oklch, var(--accent-mv) 50%, transparent)" }}
              >
                Base Network
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={`/worlds/${masterId}/scenes`}>
                <Button
                  className="h-9 px-5 text-sm font-semibold text-white"
                  style={{ background: "var(--accent-mv)" }}
                >
                  Enter Scene Deck
                </Button>
              </Link>
              {data.murals[0] && (
                <Link href={`/worlds/${data.murals[0].master_id}`}>
                  <Button variant="outline" className="h-9 px-5 text-sm">View Mural</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        <WorldTabsClient
          masterId={masterId}
          description={data.description}
          murals={data.murals}
          moments={data.moments}
          attributionRoles={data.attribution_roles}
        />
      </div>

    </div>
  );
}

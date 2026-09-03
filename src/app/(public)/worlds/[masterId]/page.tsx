import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MediaHero from "@/components/media-hero";
import MediaVisual from "@/components/media-visual";
import WorldTabsClient from "@/components/world-tabs-client";
import PageTopNav from "@/components/page-top-nav";

type MuralRow = { master_id: string; title: string | null; projection_id: string | null };
type MomentRow = { master_id: string; title: string | null; scene_projection_id: string | null };
type SceneRow = { master_id: string; title: string | null; projection_id: string | null };

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
    const { data: cmPres } = cmIds.length
      ? await svc.from("work_presentation").select("master_id, title").in("master_id", cmIds)
      : { data: [] };

    const moments: MomentRow[] = (cmMasters ?? []).map((m) => ({
      master_id: m.master_id,
      title: (cmPres ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      scene_projection_id: null,
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

  // Mural
  const { data: sceneChildren } = await svc
    .from("master")
    .select("master_id")
    .eq("parent_master_id", masterId)
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null);
  const sceneIds = (sceneChildren ?? []).map((s) => s.master_id);
  const [{ data: scenePres }, { data: sceneProjs }] = sceneIds.length
    ? await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
        svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
      ])
    : [{ data: [] }, { data: [] }];

  const scenes: SceneRow[] = (sceneChildren ?? []).map((s) => ({
    master_id: s.master_id,
    title: (scenePres ?? []).find((p) => p.master_id === s.master_id)?.title ?? null,
    projection_id: (sceneProjs ?? []).find((p) => p.master_id === s.master_id)?.projection_id ?? null,
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
  const artistLabel = data.attribution_roles.length > 0
    ? data.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
    : null;

  // ── MURAL LAYOUT — Section 06 ─────────────────────────────────────────────
  if (data.canonical_type === "mural") {
    return (
      <div className="min-h-screen bg-background">
        <PageTopNav activePath="/murals" />

        {data.universe_master_id && (
          <div className="mx-auto max-w-7xl px-6 pt-4 pb-2">
            <Link
              href={`/worlds/${data.universe_master_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>←</span>
              <span>{data.universe_title ?? "Universe"}</span>
            </Link>
          </div>
        )}

        {/* Two-column: player + scene sidebar */}
        <div className="flex flex-col lg:flex-row lg:items-start">

          {/* Left: player */}
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
            />
          </div>

          {/* Right: scene list sidebar */}
          <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card">
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scenes</p>
              <p className="text-xs text-muted-foreground">1 of {data.scenes.length || "—"}</p>
            </div>
            <div className="divide-y divide-border">
              {data.scenes.length > 0 ? (
                data.scenes.map((s, i) => (
                  <Link
                    key={s.master_id}
                    href={s.projection_id ? `/moments/${s.projection_id}` : "#"}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors group"
                  >
                    <span className="text-xs text-muted-foreground w-4 shrink-0 pt-0.5">{i + 1}</span>
                    <p className="text-sm text-foreground group-hover:opacity-80 transition-opacity truncate">
                      {s.title ?? `Scene ${i + 1}`}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">No scenes yet.</p>
              )}
            </div>
            <div className="px-4 py-4 border-t border-border">
              <Link href={`/worlds/${data.universe_master_id}/scenes`}>
                <Button variant="outline" className="w-full text-xs">View Scene Deck</Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── UNIVERSE LAYOUT — Section 03 ──────────────────────────────────────────
  const collectibleCount = 0;

  return (
    <div className="min-h-screen bg-background">
      <PageTopNav />

      {/* Hero identity block */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-12 space-y-5">

          {data.media?.playback_id && (
            <MediaVisual playbackId={data.media.playback_id} title={title} className="mb-6 rounded-lg overflow-hidden" />
          )}

          <div className="flex flex-wrap items-start gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <h1
                className="text-4xl md:text-6xl font-semibold leading-none tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>
              {artistLabel && (
                <p className="text-base text-muted-foreground">by {artistLabel}</p>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 mt-1">Universe</Badge>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-semibold text-foreground">{data.murals.length || "—"}</span>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Murals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-semibold text-foreground">{data.moments.length || "—"}</span>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Moments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-semibold text-foreground">{collectibleCount || "—"}</span>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Collectibles</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-semibold text-foreground">—</span>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Holders</span>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}
            >
              Base Network
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href={`/worlds/${masterId}/scenes`}>
              <Button style={{ background: "var(--accent-mv)" }} className="text-white font-semibold">
                Enter Scene Deck
              </Button>
            </Link>
            {data.murals[0] && (
              <Link href={`/worlds/${data.murals[0].master_id}`}>
                <Button variant="outline">View Mural</Button>
              </Link>
            )}
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-7xl px-6 py-8">
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

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";
import { Separator } from "@/components/ui/separator";
import MediaHero from "@/components/media-hero";
import MomentCard from "@/components/moment-card";
import { getServiceClient } from "@/lib/authority/validate";
import type { ProjectionMedia } from "@/components/player/projection-media-player";

const TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "scene": "Scene",
  "interpretation": "Interpretation",
  "other": "Work",
};

type MomentRow = {
  master_id: string;
  title: string | null;
  scene_projection_id: string | null;
};

type MuralRow = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

type SceneRow = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

type PageData = {
  canonical_type: string;
  master_id: string;
  title: string | null;
  description: string | null;
  media: ProjectionMedia | null;
  projection_id: string | null;
  canonical_state_id: string | null;
  // Universe-specific
  murals: MuralRow[];
  moments: MomentRow[];
  scenes: SceneRow[];
  // Mural-specific
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
    .select("master_id, canonical_type, current_state_id, parent_master_id")
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

  const { data: proj } = await svc
    .from("projection")
    .select("projection_id")
    .eq("canonical_state_id", cs.canonical_state_id)
    .eq("projection_type", "experiential")
    .single();

  const { data: pres } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", masterId)
    .maybeSingle();

  const media = proj ? await resolveMedia(svc, proj.projection_id) : null;

  if (master.canonical_type === "universe") {
    // Murals (direct children)
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

    // Creative Moments (direct children)
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
      media: null, // Universe is container — no media hero
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
  // Scenes (children of this Mural)
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

  // Resolve Universe parent for breadcrumb
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

  const typeLabel = TYPE_LABELS[data.canonical_type] ?? data.canonical_type;
  const title = data.title ?? typeLabel;

  // ── MURAL LAYOUT ──────────────────────────────────────────────────────────
  if (data.canonical_type === "mural") {
    return (
      <main className="min-h-screen bg-background">

        {/* Breadcrumb → Universe */}
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-3">
          {data.universe_master_id && (
            <Link href={`/worlds/${data.universe_master_id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span>←</span>
              <span>{data.universe_title ?? "Universe"}</span>
            </Link>
          )}
        </div>

        {/* Full Mural animation */}
        <MediaHero
          media={data.media}
          projectionId={data.projection_id ?? ""}
          masterId={data.master_id}
          canonicalStateId={data.canonical_state_id ?? ""}
          title={title}
          typeLabel="Mural"
          credit={data.description}
          collectible={false}
        />

        <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">

          {/* Scenes */}
          {data.scenes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Scenes</h2>
              <div className="space-y-2">
                {data.scenes.map((s) => (
                  <MomentCard
                    key={s.master_id}
                    projectionId={s.projection_id ?? undefined}
                    title={s.title}
                    typeLabel="Scene"
                    hasMedia={!!s.projection_id}
                    collectible={false}
                  />
                ))}
              </div>
            </section>
          )}

          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Mural · {data.master_id}</p>
            <p>The complete visual expression of the {data.universe_title ?? "Universe"}.</p>
          </div>

        </div>
      </main>
    );
  }

  // ── UNIVERSE LAYOUT ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background">

      {/* Universe identity — no media hero, Universe is the container */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 space-y-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{typeLabel}</p>
          <h1
            className="text-5xl md:text-7xl font-semibold leading-none tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {title}
          </h1>
          {data.description && (
            <p className="text-lg text-muted-foreground">{data.description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-10">

        {/* Mural — primary entry into the visual universe */}
        {data.murals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Mural</h2>
            <div className="space-y-2">
              {data.murals.map((m) => (
                <MomentCard
                  key={m.master_id}
                  projectionId={undefined}
                  title={m.title}
                  typeLabel="Mural"
                  hasMedia={false}
                  collectible={false}
                  href={`/worlds/${m.master_id}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Creative Moments */}
        {data.moments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Creative Moments</h2>
            <div className="space-y-2">
              {data.moments.map((m) => (
                <MomentCard
                  key={m.master_id}
                  projectionId={undefined}
                  title={m.title}
                  typeLabel="Creative Moment"
                  hasMedia={false}
                  collectible={false}
                  href={`/creative-moments/${m.master_id}`}
                />
              ))}
            </div>
          </section>
        )}

        <Separator />
        <div className="pt-2">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← All Universes
          </Link>
        </div>

      </div>
    </main>
  );
}

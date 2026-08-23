import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { MomentData } from "@/app/api/moments/[projectionId]/route";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Separator } from "@/components/ui/separator";
import MediaHero from "@/components/media-hero";

const TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "scene": "Scene",
  "interpretation": "Interpretation",
  "other": "Work",
};

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SceneMomentData = MomentData & {
  worldDescription: string | null;
  muralTitle: string | null;
  muralMasterId: string | null;
  worldMasterId: string | null;
  cmTitle: string | null;
  cmMasterId: string | null;
};

async function getMoment(projectionId: string): Promise<SceneMomentData | null> {
  const svc = getServiceClient();

  const { data: proj } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash, created_at, canonical_state_id, master_id")
    .eq("projection_id", projectionId)
    .single();
  if (!proj) return null;

  const [{ data: cs }, { data: master }, { data: prov }, { data: masterFull }] = await Promise.all([
    svc.from("canonical_state").select("canonical_state_id, version, authorisation_state, content_refs").eq("canonical_state_id", proj.canonical_state_id).single(),
    svc.from("master").select("master_id, canonical_type").eq("master_id", proj.master_id).single(),
    svc.from("provenance_record").select("relationship_type, integrity_hash").eq("subject_id", projectionId).eq("subject_type", "projection").eq("public", true).single(),
    svc.from("master").select("attribution_ref").eq("master_id", proj.master_id).single(),
  ]);

  const isScene = master?.canonical_type === "scene";

  const { data: attrEntries } = masterFull?.attribution_ref
    ? await svc.from("attribution_entry").select("role_type").eq("attribution_id", masterFull.attribution_ref).eq("public", true)
    : { data: [] };

  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id, start_ms, end_ms")
    .eq("projection_id", projectionId)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();

  const [{ data: projPresentation }, { data: worldPresentation }] = await Promise.all([
    svc.from("projection_presentation").select("title, description").eq("projection_id", projectionId).maybeSingle(),
    svc.from("work_presentation").select("title, description").eq("master_id", proj.master_id).maybeSingle(),
  ]);

  let media: ProjectionMedia | null = null;
  if (binding) {
    const [{ data: asset }, { data: variant }] = await Promise.all([
      svc.from("media_asset").select("storage_ref").eq("asset_id", binding.asset_id).single(),
      svc.from("delivery_variant").select("delivery_format, endpoint_ref").eq("asset_id", binding.asset_id).single(),
    ]);
    const isPlaceholder = asset?.storage_ref?.startsWith("seed:placeholder:") ?? true;
    media = {
      binding_type: binding.binding_type,
      access_level: binding.access_level,
      delivery_format: variant?.delivery_format ?? "hls",
      playback_id: isPlaceholder ? null : (asset?.storage_ref ?? null),
      is_placeholder: isPlaceholder,
      start_ms: binding.start_ms ?? null,
      end_ms: binding.end_ms ?? null,
    };
  }

  // Scene-specific: resolve Mural and associated Creative Moment
  let muralTitle: string | null = null;
  let muralMasterId: string | null = null;
  let worldMasterId: string | null = null;
  let cmTitle: string | null = null;
  let cmMasterId: string | null = null;

  if (isScene) {
    const sourceStateId = (cs?.content_refs as { source_canonical_state_id?: string } | null)?.source_canonical_state_id ?? null;
    if (sourceStateId) {
      const { data: muralState } = await svc.from("canonical_state").select("canonical_state_id, master_id").eq("canonical_state_id", sourceStateId).single() as { data: { canonical_state_id: string; master_id: string } | null };
      if (muralState) {
        muralMasterId = muralState.master_id;
        const { data: muralPres } = await svc.from("work_presentation").select("title").eq("master_id", muralState.master_id).maybeSingle();
        muralTitle = muralPres?.title ?? null;
        // Universe = parent of Mural
        const { data: muralMaster } = await svc.from("master").select("parent_master_id").eq("master_id", muralState.master_id).maybeSingle();
        worldMasterId = muralMaster?.parent_master_id ?? null;
      }
    }

    cmMasterId = null;
    cmTitle = null;
  }

  return {
    projection: {
      projection_id: proj.projection_id,
      projection_type: proj.projection_type,
      collectible_designated: proj.collectible_designated,
      integrity_hash: proj.integrity_hash,
      created_at: proj.created_at,
    },
    canonical_state: {
      canonical_state_id: cs?.canonical_state_id ?? proj.canonical_state_id,
      version: cs?.version ?? 0,
      authorisation_state: cs?.authorisation_state ?? "unknown",
      content_refs: (cs?.content_refs as Record<string, unknown> | null) ?? null,
    },
    master: {
      master_id: master?.master_id ?? proj.master_id,
      canonical_type: master?.canonical_type ?? "other",
    },
    provenance: {
      relationship_type: prov?.relationship_type ?? "",
      integrity_hash: prov?.integrity_hash ?? "",
    },
    attribution: { roles: (attrEntries ?? []).map((e) => ({ role_type: e.role_type })) },
    media,
    presentation: projPresentation ?? null,
    worldTitle: worldPresentation?.title ?? null,
    worldDescription: worldPresentation?.description ?? null,
    muralTitle,
    muralMasterId,
    worldMasterId,
    cmTitle,
    cmMasterId,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectionId: string }>;
}): Promise<Metadata> {
  const { projectionId } = await params;
  const svc = getServiceClient();
  const { data: proj } = await svc.from("projection").select("master_id").eq("projection_id", projectionId).single();
  const [{ data: pres }, { data: worldPres }] = await Promise.all([
    svc.from("projection_presentation").select("title").eq("projection_id", projectionId).maybeSingle(),
    proj ? svc.from("work_presentation").select("title, description").eq("master_id", proj.master_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const momentTitle = pres?.title ?? null;
  const worldTitle = (worldPres as { title?: string; description?: string } | null)?.title ?? null;
  const description = (worldPres as { title?: string; description?: string } | null)?.description ?? "Mighty Verse";
  const title = momentTitle
    ? `${momentTitle} — Mighty Verse`
    : worldTitle
    ? `${worldTitle} — Mighty Verse`
    : "Mighty Verse";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function MomentPage({
  params,
}: {
  params: Promise<{ projectionId: string }>;
}) {
  const { projectionId } = await params;
  const moment = await getMoment(projectionId);
  if (!moment) notFound();

  const { projection, canonical_state, master, provenance, attribution, media, presentation,
          worldTitle, muralTitle, muralMasterId, worldMasterId, cmTitle, cmMasterId } = moment;

  const parentTypeLabel = TYPE_LABELS[master.canonical_type] ?? master.canonical_type.replace(/-/g, " ");
  const projTypeLabel = PROJ_LABELS[projection.projection_type] ?? projection.projection_type.replace(/-/g, " ");
  const isScene = master.canonical_type === "scene";
  const title = presentation?.title ?? worldTitle ?? `${projTypeLabel} Moment`;

  const extractionBounds = isScene
    ? (canonical_state.content_refs as { extraction_bounds?: { semantic_identity?: string; spatial_description?: string } } | null)?.extraction_bounds ?? null
    : null;

  const credit = presentation?.description
    ?? moment.worldDescription
    ?? (attribution.roles.length > 0
      ? attribution.roles.map((r) => r.role_type.replace(/-/g, " ")).join(" · ")
      : null);

  // Breadcrumb: Scene → Mural (if known), else World
  const breadcrumbHref = muralMasterId ? `/worlds/${muralMasterId}` : worldMasterId ? `/worlds/${worldMasterId}` : "/";
  const breadcrumbLabel = muralTitle ?? worldTitle ?? "Universe";

  return (
    <main className="min-h-screen bg-background">

      {/* Breadcrumb */}
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-3">
        <Link
          href={breadcrumbHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>←</span>
          <span>{breadcrumbLabel}</span>
        </Link>
      </div>

      {/* Media + identity */}
      <MediaHero
        media={media}
        projectionId={projection.projection_id}
        masterId={master.master_id}
        canonicalStateId={canonical_state.canonical_state_id}
        title={title}
        typeLabel={isScene ? "Scene" : projTypeLabel}
        credit={credit}
        collectible={projection.collectible_designated}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">

        {/* Scene identity block */}
        {isScene && (
          <section className="space-y-5">

            {/* Semantic + spatial identity */}
            {extractionBounds && (
              <div className="space-y-1.5">
                {extractionBounds.semantic_identity && (
                  <p className="text-sm text-foreground font-medium"
                    style={{ fontFamily: "var(--font-display, inherit)" }}>
                    {extractionBounds.semantic_identity}
                  </p>
                )}
                {extractionBounds.spatial_description && (
                  <p className="text-xs text-muted-foreground">{extractionBounds.spatial_description}</p>
                )}
              </div>
            )}

            {/* Mural relationship */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">Mural</span>
              {muralMasterId ? (
                <Link
                  href={`/worlds/${muralMasterId}`}
                  className="text-foreground hover:opacity-70 transition-opacity font-medium"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {muralTitle ?? "Mural"}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{muralTitle ?? "Mural"}</span>
              )}
            </div>

            {/* Creative Moment association */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">Creative Moment</span>
              {cmTitle && cmMasterId ? (
                <Link
                  href={`/creative-moments/${cmMasterId}`}
                  className="text-foreground hover:opacity-70 transition-opacity font-medium"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {cmTitle}
                </Link>
              ) : cmTitle ? (
                <span className="text-foreground font-medium">{cmTitle}</span>
              ) : (
                <span className="text-muted-foreground text-xs italic">None — this Scene has no Creative Moment counterpart</span>
              )}
            </div>

            {/* Media realization range */}
            {media?.start_ms != null && media?.end_ms != null && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground text-xs uppercase tracking-widest">Realization</span>
                <span className="text-foreground font-mono text-xs">
                  {formatMs(media.start_ms)} – {formatMs(media.end_ms)}
                </span>
                <span className="text-muted-foreground text-xs">temporal range within Mural animation</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground italic">
              This is a canonical Scene — a visual/spatial unit of the Mural. The current experience is a temporal media realization, not the Scene&apos;s canonical identity.
            </p>
          </section>
        )}

        {/* Non-scene world relationship */}
        {!isScene && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Part of</span>
            <Link
              href={`/worlds/${master.master_id}`}
              className="text-foreground hover:opacity-70 transition-opacity font-medium"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              {worldTitle ?? parentTypeLabel}
            </Link>
            <span className="text-xs text-muted-foreground">· {parentTypeLabel}</span>
          </div>
        )}

        {/* Canonical Record */}
        <Separator />
        <details>
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-widest cursor-pointer select-none hover:text-foreground transition-colors">
            Canonical Record
          </summary>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">{isScene ? "Scene" : "Moment"}</span>
              <span className="text-muted-foreground font-mono break-all">{projection.projection_id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Master</span>
              <span className="text-muted-foreground font-mono break-all">{master.master_id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">State</span>
              <span className="text-muted-foreground font-mono break-all">{canonical_state.canonical_state_id}</span>
            </div>
            {provenance.integrity_hash && (
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground w-24 shrink-0">Hash</span>
                <span className="text-muted-foreground font-mono break-all">{provenance.integrity_hash}</span>
              </div>
            )}
          </div>
        </details>

      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { MomentData } from "@/app/api/moments/[projectionId]/route";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ArtworkFrame from "@/components/artwork-frame";
import PageTopNav from "@/components/page-top-nav";

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

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
        const { data: muralMaster } = await svc.from("master").select("parent_master_id").eq("master_id", muralState.master_id).single();
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
          worldTitle, muralTitle, muralMasterId, worldMasterId } = moment;

  const projTypeLabel = PROJ_LABELS[projection.projection_type] ?? projection.projection_type.replace(/-/g, " ");
  const isScene = master.canonical_type === "scene";
  const title = presentation?.title ?? `${projTypeLabel} Moment`;

  const breadcrumbHref = muralMasterId ? `/worlds/${muralMasterId}` : worldMasterId ? `/worlds/${worldMasterId}` : "/";
  const breadcrumbLabel = muralTitle ?? worldTitle ?? "Universe";

  const rarityLabel = projection.collectible_designated ? "Rare" : "Common";

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/moments" />

      <div className="mx-auto max-w-5xl px-6 py-8">

        {/* Breadcrumb */}
        <Link
          href={breadcrumbHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <span>←</span>
          <span>{breadcrumbLabel}</span>
        </Link>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row gap-10">

          {/* Left: card artwork */}
          <div className="w-full md:w-64 shrink-0 space-y-3">
            <div className="relative">
              {projection.collectible_designated && (
                <div className="absolute top-3 left-3 z-10">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: "var(--accent-mv-gold)", color: "#000" }}
                  >
                    RARE
                  </span>
                </div>
              )}
              <ArtworkFrame artworkUrl={null} alt={title} aspectRatio="2/3" />
            </div>
            <p
              className="text-lg font-semibold text-foreground text-center uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              {title}
            </p>
          </div>

          {/* Right: detail */}
          <div className="flex-1 min-w-0 space-y-6">

            <div className="space-y-1">
              <h1
                className="text-3xl font-semibold text-foreground leading-tight"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>

              {/* Scene reference */}
              {isScene && muralMasterId && (
                <p className="text-sm text-muted-foreground">
                  Scene:{" "}
                  <Link href={`/worlds/${muralMasterId}`} className="text-foreground hover:opacity-70 transition-opacity">
                    {muralTitle ?? "Mural"}
                  </Link>
                </p>
              )}

              {/* Mural / Universe reference */}
              {worldTitle && (
                <p className="text-sm text-muted-foreground">
                  Mural:{" "}
                  <Link href={`/worlds/${master.master_id}`} className="text-foreground hover:opacity-70 transition-opacity">
                    {worldTitle}
                  </Link>
                </p>
              )}
            </div>

            {/* Description */}
            {presentation?.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{presentation.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description yet.</p>
            )}

            {/* Tag pills */}
            <div className="flex flex-wrap gap-2">
              {projection.collectible_designated && (
                <Badge variant="outline" style={{ color: "var(--accent-mv-gold)", borderColor: "var(--accent-mv-gold)" }}>
                  Collectible
                </Badge>
              )}
              <Badge variant="outline">Moment Card</Badge>
              <Badge variant="outline">ERC-1155</Badge>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Rarity", value: rarityLabel },
                { label: "Edition", value: `#— / —` },
                { label: "Owner", value: "—" },
                { label: "Token ID", value: "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card border border-border rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-foreground font-mono">{value}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="outline" disabled>View in 2.5D</Button>
              <Button disabled style={{ background: "var(--accent-mv)" }} className="text-white">
                Add to Timeline
              </Button>
            </div>

          </div>
        </div>

        {/* Canonical record */}
        <Separator className="my-10" />
        <details>
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-widest cursor-pointer select-none hover:text-foreground transition-colors">
            Canonical Record
          </summary>
          <div className="mt-4 space-y-3 text-xs">
            {[
              { label: isScene ? "Scene" : "Moment", value: projection.projection_id },
              { label: "Master", value: master.master_id },
              { label: "State", value: canonical_state.canonical_state_id },
              ...(provenance.integrity_hash ? [{ label: "Hash", value: provenance.integrity_hash }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                <span className="text-muted-foreground font-mono break-all">{value}</span>
              </div>
            ))}
          </div>
        </details>

      </div>
    </main>
  );
}

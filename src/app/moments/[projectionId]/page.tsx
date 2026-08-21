import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { MomentData } from "@/app/api/moments/[projectionId]/route";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ProjectionMediaPlayer from "@/components/player/projection-media-player";

const TYPE_LABELS: Record<string, string> = {
  "song-world": "Song World",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "interpretation": "Interpretation",
  "other": "Work",
};

const PROJ_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Moment",
};

async function getMoment(projectionId: string): Promise<MomentData | null> {
  const svc = getServiceClient();

  const { data: proj } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash, created_at, canonical_state_id, master_id")
    .eq("projection_id", projectionId)
    .single();
  if (!proj) return null;

  const [{ data: cs }, { data: master }, { data: prov }, { data: masterFull }] =
    await Promise.all([
      svc.from("canonical_state").select("canonical_state_id, version, authorisation_state").eq("canonical_state_id", proj.canonical_state_id).single(),
      svc.from("master").select("master_id, canonical_type").eq("master_id", proj.master_id).single(),
      svc.from("provenance_record").select("relationship_type, integrity_hash").eq("subject_id", projectionId).eq("subject_type", "projection").eq("public", true).single(),
      svc.from("master").select("attribution_ref").eq("master_id", proj.master_id).single(),
    ]);

  const { data: attrEntries } = masterFull?.attribution_ref
    ? await svc.from("attribution_entry").select("role_type").eq("attribution_id", masterFull.attribution_ref).eq("public", true)
    : { data: [] };

  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id")
    .eq("projection_id", projectionId)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();

  // Fetch both presentation records in parallel — neither touches the canonical chain
  const [{ data: projPresentation }, { data: worldPresentation }] = await Promise.all([
    svc.from("projection_presentation").select("title, description").eq("projection_id", projectionId).maybeSingle(),
    svc.from("work_presentation").select("title").eq("master_id", proj.master_id).maybeSingle(),
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
    };
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

  const { projection, canonical_state, master, provenance, attribution, media, presentation, worldTitle } = moment;

  const parentLabel = worldTitle ?? (TYPE_LABELS[master.canonical_type] ?? master.canonical_type.replace(/-/g, " "));
  const projTypeLabel = PROJ_LABELS[projection.projection_type] ?? projection.projection_type.replace(/-/g, " ");

  return (
    <main className="min-h-screen bg-background">

      {/* Media */}
      <section className="w-full bg-black">
        <ProjectionMediaPlayer
          media={media}
          projectionId={projection.projection_id}
          masterId={master.master_id}
          canonicalStateId={canonical_state.canonical_state_id}
        />
      </section>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">

        {/* Back to World */}
        <Link
          href={`/worlds/${master.master_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>←</span>
          <span>Back to {parentLabel}</span>
        </Link>

        {/* Moment identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground text-lg font-semibold">
              {presentation?.title ?? `${projTypeLabel} Moment`}
            </span>
            {projection.collectible_designated && (
              <Badge variant="outline">collectible</Badge>
            )}
          </div>
          {presentation?.title && (
            <p className="text-muted-foreground text-xs">{projTypeLabel}</p>
          )}
          {presentation?.description && (
            <p className="text-muted-foreground text-sm">{presentation.description}</p>
          )}
          {attribution.roles.length > 0 && (
            <p className="text-muted-foreground text-sm capitalize">
              {attribution.roles.map((r) => r.role_type.replace(/-/g, " ")).join(" · ")}
            </p>
          )}
        </div>

        {/* Canonical Record — secondary */}
        <Separator />
        <details className="group">
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors">
            Canonical Record
          </summary>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Moment</span>
              <span className="text-muted-foreground font-mono break-all">{projection.projection_id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">World</span>
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

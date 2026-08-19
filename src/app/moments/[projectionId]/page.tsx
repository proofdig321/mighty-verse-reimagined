import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import type { MomentData } from "@/app/api/moments/[projectionId]/route";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ProjectionMediaPlayer from "@/components/player/projection-media-player";

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
  };
}

function label(s: string) {
  return s.replace(/-/g, " ");
}

export default async function MomentPage({
  params,
}: {
  params: Promise<{ projectionId: string }>;
}) {
  const { projectionId } = await params;
  const moment = await getMoment(projectionId);
  if (!moment) notFound();

  const { projection, canonical_state, master, provenance, attribution, media } = moment;

  return (
    <main className="min-h-screen bg-background">
      {/* Media — primary visual element */}
      <section className="w-full bg-black">
        <ProjectionMediaPlayer
          media={media}
          projectionId={projection.projection_id}
          masterId={master.master_id}
          canonicalStateId={canonical_state.canonical_state_id}
        />
      </section>

      <section className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Projection identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="capitalize">{label(projection.projection_type)}</Badge>
            <Badge variant="outline">v{canonical_state.version}</Badge>
            <Badge className="capitalize">{canonical_state.authorisation_state}</Badge>
            {projection.collectible_designated && <Badge variant="outline">collectible</Badge>}
          </div>
          <p className="text-muted-foreground text-xs font-mono">{projection.projection_id}</p>
        </div>

        {/* Link to parent World */}
        <Link
          href={`/worlds/${master.master_id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="capitalize">{label(master.canonical_type)}</span>
          <span>→</span>
          <span className="font-mono truncate max-w-[200px]">{master.master_id}</span>
        </Link>

        <Separator />

        {/* Attribution */}
        {attribution.roles.length > 0 && (
          <div className="space-y-1">
            <p className="text-foreground text-xs font-medium uppercase tracking-wider">Created by</p>
            <div className="flex gap-2 flex-wrap">
              {attribution.roles.map((r) => (
                <Badge key={r.role_type} variant="secondary" className="capitalize">
                  {label(r.role_type)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Provenance */}
        {provenance.relationship_type && (
          <div className="space-y-2">
            <p className="text-foreground text-xs font-medium uppercase tracking-wider">Provenance</p>
            <div className="flex items-start gap-3 text-xs">
              <span className="text-muted-foreground w-24 shrink-0 capitalize">{label(provenance.relationship_type)}</span>
              <p className="text-muted-foreground font-mono break-all">{provenance.integrity_hash}</p>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}

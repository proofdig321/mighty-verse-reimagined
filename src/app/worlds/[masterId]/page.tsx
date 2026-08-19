import { notFound } from "next/navigation";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import WorldMedia from "./world-media";
import { getServiceClient } from "@/lib/authority/validate";

async function getWorld(masterId: string): Promise<WorldData | null> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, attribution_ref")
    .eq("master_id", masterId)
    .single();
  if (!master) return null;

  const { data: cs } = await svc
    .from("canonical_state")
    .select("canonical_state_id, version, authorisation_state, integrity_hash, created_at")
    .eq("canonical_state_id", master.current_state_id)
    .eq("authorisation_state", "authorised")
    .single();
  if (!cs) return null;

  const { data: proj } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash")
    .eq("canonical_state_id", cs.canonical_state_id)
    .eq("projection_type", "experiential")
    .single();
  if (!proj) return null;

  const { data: provRecords } = await svc
    .from("provenance_record")
    .select("subject_id, subject_type, relationship_type, integrity_hash")
    .in("subject_id", [cs.canonical_state_id, proj.projection_id])
    .eq("public", true);

  const provCS = provRecords?.find((p) => p.subject_type === "canonical-state");
  const provProj = provRecords?.find((p) => p.subject_type === "projection");

  const { data: attrEntries } = await svc
    .from("attribution_entry")
    .select("role_type")
    .eq("attribution_id", master.attribution_ref)
    .eq("public", true);

  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id")
    .eq("projection_id", proj.projection_id)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();

  let media: WorldData["media"] = null;
  if (binding) {
    const { data: asset } = await svc
      .from("media_asset")
      .select("storage_ref")
      .eq("asset_id", binding.asset_id)
      .single();
    const { data: variant } = await svc
      .from("delivery_variant")
      .select("delivery_format, endpoint_ref")
      .eq("asset_id", binding.asset_id)
      .single();
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
    master: { master_id: master.master_id, canonical_type: master.canonical_type },
    canonical_state: {
      canonical_state_id: cs.canonical_state_id,
      version: cs.version,
      authorisation_state: cs.authorisation_state,
      integrity_hash: cs.integrity_hash,
      created_at: cs.created_at,
    },
    projection: {
      projection_id: proj.projection_id,
      projection_type: proj.projection_type,
      collectible_designated: proj.collectible_designated,
      integrity_hash: proj.integrity_hash,
    },
    provenance: {
      canonical_state: {
        relationship_type: provCS?.relationship_type ?? "",
        integrity_hash: provCS?.integrity_hash ?? "",
      },
      projection: {
        relationship_type: provProj?.relationship_type ?? "",
        integrity_hash: provProj?.integrity_hash ?? "",
      },
    },
    attribution: { roles: (attrEntries ?? []).map((e) => ({ role_type: e.role_type })) },
    media,
  };
}

function label(type: string) {
  return type.replace(/-/g, " ");
}

export default async function WorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const world = await getWorld(masterId);
  if (!world) notFound();

  const { master, canonical_state, projection, provenance, attribution, media } = world;

  return (
    <main className="min-h-screen bg-background">
      {/* Media zone — full-width, media-first */}
      <section className="relative w-full bg-black">
        <WorldMedia media={media} projection={projection} master={master} canonicalState={canonical_state} />
      </section>

      {/* Identity + provenance */}
      <section className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* World identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize">{label(master.canonical_type)}</Badge>
            <Badge variant="secondary" className="capitalize">{label(projection.projection_type)}</Badge>
            <Badge variant="outline">v{canonical_state.version}</Badge>
            <Badge className="capitalize">{canonical_state.authorisation_state}</Badge>
          </div>
          <p className="text-muted-foreground text-xs font-mono">{master.master_id}</p>
        </div>

        <Separator />

        {/* Attribution — public roles only */}
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

        {/* Provenance — public records only */}
        <div className="space-y-3">
          <p className="text-foreground text-xs font-medium uppercase tracking-wider">Provenance</p>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-28 shrink-0">Canonical state</span>
              <div className="space-y-0.5">
                <p className="text-foreground capitalize">{label(provenance.canonical_state.relationship_type)}</p>
                <p className="text-muted-foreground font-mono break-all">{provenance.canonical_state.integrity_hash}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-28 shrink-0">Projection</span>
              <div className="space-y-0.5">
                <p className="text-foreground capitalize">{label(provenance.projection.relationship_type)}</p>
                <p className="text-muted-foreground font-mono break-all">{provenance.projection.integrity_hash}</p>
              </div>
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}

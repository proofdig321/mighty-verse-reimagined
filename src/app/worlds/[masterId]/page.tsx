import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";
import { Separator } from "@/components/ui/separator";
import MediaHero from "@/components/media-hero";
import MomentCard from "@/components/moment-card";
import { getServiceClient } from "@/lib/authority/validate";

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

type MomentRow = {
  projection_id: string;
  projection_type: string;
  collectible_designated: boolean;
  title: string | null;
  has_media: boolean;
};

type WorldPageData = WorldData & {
  moments: MomentRow[];
  presentation: { title: string; description: string | null } | null;
};

async function getWorld(masterId: string): Promise<WorldPageData | null> {
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

  const { data: allProjections } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash")
    .eq("canonical_state_id", cs.canonical_state_id)
    .order("created_at", { ascending: true });

  const proj = (allProjections ?? []).find((p) => p.projection_type === "experiential") ?? null;
  if (!proj) return null;

  const projectionIds = (allProjections ?? []).map((p) => p.projection_id);

  const [
    { data: provRecords },
    { data: attrEntries },
    { data: binding },
    { data: presentationRow },
    { data: projPresentations },
    { data: mediaBindings },
  ] = await Promise.all([
    svc.from("provenance_record")
      .select("subject_id, subject_type, relationship_type, integrity_hash")
      .in("subject_id", [cs.canonical_state_id, proj.projection_id])
      .eq("public", true),
    svc.from("attribution_entry")
      .select("role_type")
      .eq("attribution_id", master.attribution_ref)
      .eq("public", true),
    svc.from("projection_media_binding")
      .select("binding_type, access_level, asset_id")
      .eq("projection_id", proj.projection_id)
      .eq("binding_type", "primary")
      .eq("access_level", "public")
      .single(),
    svc.from("work_presentation")
      .select("title, description")
      .eq("master_id", masterId)
      .maybeSingle(),
    projectionIds.length
      ? svc.from("projection_presentation").select("projection_id, title").in("projection_id", projectionIds)
      : Promise.resolve({ data: [] }),
    projectionIds.length
      ? svc.from("projection_media_binding").select("projection_id, asset_id").in("projection_id", projectionIds).eq("access_level", "public")
      : Promise.resolve({ data: [] }),
  ]);

  const provCS = provRecords?.find((p) => p.subject_type === "canonical-state");
  const provProj = provRecords?.find((p) => p.subject_type === "projection");

  // Determine which projections have non-placeholder media
  const boundAssetIds = (mediaBindings ?? []).map((b) => b.asset_id);
  let mediaSet = new Set<string>();
  if (boundAssetIds.length) {
    const { data: assets } = await svc
      .from("media_asset")
      .select("asset_id, storage_ref")
      .in("asset_id", boundAssetIds);
    mediaSet = new Set(
      (assets ?? [])
        .filter((a) => !a.storage_ref?.startsWith("seed:placeholder:"))
        .map((a) => a.asset_id)
    );
  }
  const projHasMedia = new Map<string, boolean>();
  for (const b of mediaBindings ?? []) {
    projHasMedia.set(b.projection_id, mediaSet.has(b.asset_id));
  }

  let media: WorldData["media"] = null;
  if (binding) {
    const { data: asset } = await svc.from("media_asset").select("storage_ref").eq("asset_id", binding.asset_id).single();
    const { data: variant } = await svc.from("delivery_variant").select("delivery_format, endpoint_ref").eq("asset_id", binding.asset_id).single();
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
      canonical_state: { relationship_type: provCS?.relationship_type ?? "", integrity_hash: provCS?.integrity_hash ?? "" },
      projection: { relationship_type: provProj?.relationship_type ?? "", integrity_hash: provProj?.integrity_hash ?? "" },
    },
    attribution: { roles: (attrEntries ?? []).map((e) => ({ role_type: e.role_type })) },
    media,
    moments: (allProjections ?? []).map((p) => ({
      projection_id: p.projection_id,
      projection_type: p.projection_type,
      collectible_designated: p.collectible_designated,
      title: (projPresentations ?? []).find((pp) => pp.projection_id === p.projection_id)?.title ?? null,
      has_media: projHasMedia.get(p.projection_id) ?? false,
    })),
    presentation: presentationRow ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const svc = getServiceClient();
  const { data: pres } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", masterId)
    .maybeSingle();
  const title = pres?.title ? `${pres.title} — Mighty Verse` : "Mighty Verse";
  return { title, description: pres?.description ?? "Mighty Verse" };
}

export default async function WorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const world = await getWorld(masterId);
  if (!world) notFound();

  const { master, canonical_state, projection, provenance, attribution, media, moments, presentation } = world;

  const typeLabel = TYPE_LABELS[master.canonical_type] ?? master.canonical_type.replace(/-/g, " ");
  const title = presentation?.title ?? typeLabel;

  // Credit: prefer presentation description, fall back to role types
  const credit = presentation?.description
    ?? (attribution.roles.length > 0
      ? attribution.roles.map((r) => r.role_type.replace(/-/g, " ")).join(" · ")
      : null);

  return (
    <main className="min-h-screen bg-background">

      {/* MediaHero — media + identity as one unit */}
      <MediaHero
        media={media}
        projectionId={projection.projection_id}
        masterId={master.master_id}
        canonicalStateId={canonical_state.canonical_state_id}
        title={title}
        typeLabel={typeLabel}
        credit={credit}
        collectible={projection.collectible_designated}
      />

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">

        {/* Moments */}
        {moments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Moments</h2>
            <div className="space-y-2">
              {moments.map((m) => (
                <MomentCard
                  key={m.projection_id}
                  projectionId={m.projection_id}
                  title={m.title}
                  typeLabel={PROJ_LABELS[m.projection_type] ?? m.projection_type.replace(/-/g, " ")}
                  hasMedia={m.has_media}
                  collectible={m.collectible_designated}
                />
              ))}
            </div>
          </section>
        )}

        {/* Canonical Record — secondary, collapsible */}
        <Separator />
        <details>
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-widest cursor-pointer select-none hover:text-foreground transition-colors">
            Canonical Record
          </summary>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Work</span>
              <span className="text-muted-foreground font-mono break-all">{master.master_id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">State</span>
              <span className="text-muted-foreground font-mono break-all">{canonical_state.canonical_state_id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Version</span>
              <span className="text-muted-foreground">v{canonical_state.version} · {canonical_state.authorisation_state}</span>
            </div>
            {provenance.canonical_state.integrity_hash && (
              <div className="flex items-start gap-3">
                <span className="text-muted-foreground w-24 shrink-0">Hash</span>
                <span className="text-muted-foreground font-mono break-all">{provenance.canonical_state.integrity_hash}</span>
              </div>
            )}
          </div>
        </details>

      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import WorldMedia from "./world-media";
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
};

type WorldPageData = WorldData & { moments: MomentRow[]; presentation: { title: string; description: string | null } | null };

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

  // Fetch all projections for this canonical state — used for Moments section
  // Relationship: projection.canonical_state_id = cs.canonical_state_id (safe, explicit)
  const { data: allProjections } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash")
    .eq("canonical_state_id", cs.canonical_state_id)
    .order("created_at", { ascending: true });

  // The primary experiential projection for the player
  const proj = (allProjections ?? []).find((p) => p.projection_type === "experiential") ?? null;
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

  const { data: presentationRow } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", masterId)
    .maybeSingle();

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
    moments: (allProjections ?? []).map((p) => ({
      projection_id: p.projection_id,
      projection_type: p.projection_type,
      collectible_designated: p.collectible_designated,
    })),
    presentation: presentationRow ?? null,
  };
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

  return (
    <main className="min-h-screen bg-background">

      {/* Media — full-width, media-first */}
      <section className="w-full bg-black">
        <WorldMedia media={media} projection={projection} master={master} canonicalState={canonical_state} />
      </section>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">

        {/* World identity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground text-lg font-semibold">
              {presentation?.title ?? typeLabel}
            </span>
            {projection.collectible_designated && (
              <Badge variant="outline">collectible</Badge>
            )}
          </div>
          {presentation?.title && (
            <p className="text-muted-foreground text-xs">{typeLabel}</p>
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

        {/* Moments */}
        {moments.length > 0 && (
          <>
            <Separator />
            <section className="space-y-3">
              <h2 className="text-foreground text-xs font-medium uppercase tracking-wider">Moments</h2>
              <div className="space-y-2">
                {moments.map((m) => (
                  <Link
                    key={m.projection_id}
                    href={`/moments/${m.projection_id}`}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-md border border-border hover:border-foreground/20 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm">
                        {PROJ_LABELS[m.projection_type] ?? m.projection_type.replace(/-/g, " ")} Moment
                      </span>
                      {m.collectible_designated && (
                        <Badge variant="outline" className="text-xs py-0">collectible</Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">→</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Canonical Record — secondary */}
        <Separator />
        <details className="group">
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors">
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

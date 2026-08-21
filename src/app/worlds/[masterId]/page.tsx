import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";
import { Separator } from "@/components/ui/separator";
import MediaHero from "@/components/media-hero";
import MomentCard from "@/components/moment-card";
import ExperienceToggle from "@/components/experience-toggle";
import { getServiceClient } from "@/lib/authority/validate";

const TYPE_LABELS: Record<string, string> = {
  "song-world": "Song World",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "scene": "Scene",
  "interpretation": "Interpretation",
  "other": "Work",
};

type MomentRow = {
  master_id: string;
  title: string | null;
  scene_projection_id: string | null; // projection_id of the associated Scene, if any
};

type MuralRow = {
  master_id: string;
  title: string | null;
};

type SceneRow = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

// Static Scene → Creative Moment mapping (canonical fact from Build 13).
// Golden Shovel has no Creative Moment counterpart — intentional.
const SCENE_TO_CM: Record<string, string> = {
  "bebb65d2-21ed-4bc9-9fa0-a4857df30a43": "32422bb4-d03c-465d-8348-942e49ae0051", // Mothipa
  "df15ec76-6bd8-4956-bbaa-755f72b2b8f8": "3b0de6b4-2ca0-43c0-8561-7dc1c0697435", // ProVerb
  "65490a92-8faf-42ea-a391-0e6473360f5c": "2745a50a-5417-4613-b23b-ef4857ab112e", // Reason
};

type WorldPageData = WorldData & {
  moments: MomentRow[];
  murals: MuralRow[];
  scenes: SceneRow[];
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

  const [
    { data: provRecords },
    { data: attrEntries },
    { data: binding },
    { data: presentationRow },
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
  ]);

  const provCS = provRecords?.find((p) => p.subject_type === "canonical-state");
  const provProj = provRecords?.find((p) => p.subject_type === "projection");

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
    moments: await (async () => {
      const { data: momentMasters } = await svc
        .from("master")
        .select("master_id")
        .eq("parent_master_id", masterId)
        .eq("canonical_type", "creative-moment")
        .not("current_state_id", "is", null);
      if (!momentMasters?.length) return [];
      const momentIds = momentMasters.map((m) => m.master_id);
      const { data: momentPresentations } = await svc
        .from("work_presentation").select("master_id, title").in("master_id", momentIds);

      // Build CM → Scene projection map from static relationship
      const cmToSceneProj: Record<string, string> = {};
      const cmToScene = Object.fromEntries(Object.entries(SCENE_TO_CM).map(([s, c]) => [c, s]));
      const sceneMasterIds = Object.keys(SCENE_TO_CM);
      if (sceneMasterIds.length) {
        const { data: sceneProjs } = await svc
          .from("projection")
          .select("master_id, projection_id")
          .in("master_id", sceneMasterIds)
          .eq("projection_type", "experiential");
        for (const sp of sceneProjs ?? []) {
          const cmId = SCENE_TO_CM[sp.master_id];
          if (cmId) cmToSceneProj[cmId] = sp.projection_id;
        }
      }

      return momentMasters.map((m) => ({
        master_id: m.master_id,
        title: (momentPresentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
        scene_projection_id: cmToSceneProj[m.master_id] ?? null,
      }));
    })(),
    scenes: await (async () => {
      const { data: sceneMasters } = await svc
        .from("master")
        .select("master_id")
        .eq("parent_master_id", masterId)
        .eq("canonical_type", "mural")
        .not("current_state_id", "is", null);
      // Scenes are children of the Mural, not the World — fetch via Mural children
      const muralIds = (sceneMasters ?? []).map((m) => m.master_id);
      if (!muralIds.length) return [];
      const { data: sceneChildren } = await svc
        .from("master")
        .select("master_id")
        .in("parent_master_id", muralIds)
        .eq("canonical_type", "scene")
        .not("current_state_id", "is", null);
      if (!sceneChildren?.length) return [];
      const sceneIds = sceneChildren.map((s) => s.master_id);
      const [{ data: scenePres }, { data: sceneProjs }] = await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
        svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
      ]);
      return sceneChildren.map((s) => ({
        master_id: s.master_id,
        title: (scenePres ?? []).find((p) => p.master_id === s.master_id)?.title ?? null,
        projection_id: (sceneProjs ?? []).find((p) => p.master_id === s.master_id)?.projection_id ?? null,
      }));
    })(),
    murals: await (async () => {
      const { data: muralMasters } = await svc
        .from("master")
        .select("master_id")
        .eq("parent_master_id", masterId)
        .eq("canonical_type", "mural")
        .not("current_state_id", "is", null);
      if (!muralMasters?.length) return [];
      const muralIds = muralMasters.map((m) => m.master_id);
      const { data: muralPresentations } = await svc
        .from("work_presentation")
        .select("master_id, title")
        .in("master_id", muralIds);
      return muralMasters.map((m) => ({
        master_id: m.master_id,
        title: (muralPresentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
      }));
    })(),
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
  const description = pres?.description ?? "Mighty Verse";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
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

  const { master, canonical_state, projection, provenance, attribution, media, moments, murals, scenes, presentation } = world;

  const typeLabel = TYPE_LABELS[master.canonical_type] ?? master.canonical_type.replace(/-/g, " ");
  const title = presentation?.title ?? typeLabel;

  const credit = presentation?.description
    ?? (attribution.roles.length > 0
      ? attribution.roles.map((r) => r.role_type.replace(/-/g, " ")).join(" · ")
      : null);

  return (
    <main className="min-h-screen bg-background">

      {/* Media + identity */}
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

      <div className="mx-auto max-w-5xl px-4 py-10 space-y-10">

        {/* Murals — only rendered when authorised Mural records exist */}
        {murals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Mural</h2>
            <div className="space-y-2">
              {murals.map((m) => (
                <div key={m.master_id} className="px-5 py-4 rounded-lg border border-border bg-card">
                  <p className="text-sm font-medium text-foreground"
                    style={{ fontFamily: "var(--font-display, inherit)" }}>
                    {m.title ?? "Mural"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Moments — Creative Moment cards navigate to their associated Scene */}
        {moments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Creative Moments</h2>
            <div className="space-y-2">
              {moments.map((m) => (
                <MomentCard
                  key={m.master_id}
                  projectionId={m.scene_projection_id ?? undefined}
                  title={m.title}
                  typeLabel="Creative Moment"
                  hasMedia={!!m.scene_projection_id}
                  collectible={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* Scenes — independently discoverable visual/spatial canonical units */}
        {scenes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Scenes</h2>
            <div className="space-y-2">
              {scenes.map((s) => (
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

        {/* Experience toggle — below Moments, above Canonical Record */}
        <ExperienceToggle />

        {/* Canonical Record — secondary, collapsible */}
        <Separator />
        <details>
          <summary className="text-muted-foreground text-xs font-medium uppercase tracking-widest cursor-pointer select-none hover:text-foreground transition-colors">
            Canonical Record
          </summary>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className="text-muted-foreground w-24 shrink-0">World</span>
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

        {/* Back */}
        <div className="pt-2">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← All Worlds
          </Link>
        </div>

      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";
import { CURATE_LIFECYCLE, CURATE_STUDIO_HREF } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import CurateStudioGateway from "@/components/assemble/curate-studio-gateway";
import CurateClient from "./curate-client";

export type CurateUniverse = {
  master_id: string;
  title: string | null;
};

export type CurateMural = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
  asset_id: string | null;
  provider: string | null;
  storage_ref: string | null;
  duration_ms: number | null;
};

export type CurateScene = {
  master_id: string;
  title: string | null;
  sort_order: number | null;
  start_ms: number | null;
  end_ms: number | null;
  projection_id: string | null;
  asset_id: string | null;
};

export type CurateAsset = {
  asset_id: string;
  provider: string | null;
  storage_ref: string;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
};

async function loadInspectionContext(universeId: string | null, universeIds: string[]) {
  const svc = getServiceClient();

  if (!universeId || !universeIds.includes(universeId)) {
    return { mural: null as CurateMural | null, scenes: [] as CurateScene[], availableAssets: [] as CurateAsset[] };
  }

  const { data: muralMasters } = await svc
    .from("master")
    .select("master_id")
    .eq("canonical_type", "mural")
    .eq("parent_master_id", universeId)
    .order("created_at", { ascending: true })
    .limit(1);

  const muralMasterId = muralMasters?.[0]?.master_id ?? null;
  let mural: CurateMural | null = null;

  if (muralMasterId) {
    const [{ data: muralPres }, { data: muralProjs }] = await Promise.all([
      svc.from("work_presentation").select("title").eq("master_id", muralMasterId).maybeSingle(),
      svc.from("projection").select("projection_id").eq("master_id", muralMasterId).limit(1),
    ]);
    const muralProjId = muralProjs?.[0]?.projection_id ?? null;
    let assetId: string | null = null;
    let provider: string | null = null;
    let storageRef: string | null = null;
    let durationMs: number | null = null;
    if (muralProjId) {
      const { data: binding } = await svc
        .from("projection_media_binding")
        .select("asset_id, media_asset(asset_id, provider, storage_ref, duration_ms)")
        .eq("projection_id", muralProjId)
        .eq("binding_type", "primary")
        .maybeSingle();
      if (binding) {
        assetId = binding.asset_id;
        const ma = (binding.media_asset as unknown) as { provider: string | null; storage_ref: string; duration_ms: number | null } | null;
        provider = ma?.provider ?? null;
        storageRef = ma?.storage_ref ?? null;
        durationMs = ma?.duration_ms ?? null;
      }
    }
    mural = {
      master_id: muralMasterId,
      title: muralPres?.title ?? null,
      projection_id: muralProjId,
      asset_id: assetId,
      provider,
      storage_ref: storageRef,
      duration_ms: durationMs,
    };
  }

  let scenes: CurateScene[] = [];
  if (muralMasterId) {
    const { data: sceneMasters } = await svc
      .from("master")
      .select("master_id, sort_order")
      .eq("canonical_type", "scene")
      .eq("parent_master_id", muralMasterId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (sceneMasters?.length) {
      const sceneIds = sceneMasters.map((s) => s.master_id);
      const [{ data: scenePres }, { data: sceneProjs }] = await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
        svc.from("projection").select("projection_id, master_id").in("master_id", sceneIds),
      ]);
      const sceneProjIds = (sceneProjs ?? []).map((p) => p.projection_id);
      const { data: sceneBindings } = sceneProjIds.length
        ? await svc
            .from("projection_media_binding")
            .select("projection_id, asset_id, start_ms, end_ms")
            .in("projection_id", sceneProjIds)
            .eq("binding_type", "primary")
        : { data: [] };

      scenes = sceneMasters.map((s) => {
        const proj = (sceneProjs ?? []).find((p) => p.master_id === s.master_id);
        const binding = proj
          ? (sceneBindings ?? []).find((b) => b.projection_id === proj.projection_id)
          : null;
        return {
          master_id: s.master_id,
          title: (scenePres ?? []).find((p) => p.master_id === s.master_id)?.title ?? null,
          sort_order: s.sort_order ?? null,
          start_ms: binding?.start_ms ?? null,
          end_ms: binding?.end_ms ?? null,
          projection_id: proj?.projection_id ?? null,
          asset_id: binding?.asset_id ?? null,
        };
      });
    }
  }

  const { data: rawAssets } = await svc
    .from("media_asset")
    .select("asset_id, provider, storage_ref, duration_ms, width, height, intake_id")
    .in("asset_type", ["original", "streaming-variant"])
    .not("storage_ref", "like", "seed:placeholder:%")
    .order("created_at", { ascending: false });

  const assetIntakeIds = (rawAssets ?? []).map((a) => a.intake_id).filter(Boolean) as string[];
  const { data: intakes } = assetIntakeIds.length
    ? await svc.from("media_intake").select("intake_id, title").in("intake_id", assetIntakeIds)
    : { data: [] };

  const availableAssets: CurateAsset[] = (rawAssets ?? []).map((a) => ({
    asset_id: a.asset_id,
    provider: a.provider,
    storage_ref: a.storage_ref,
    duration_ms: a.duration_ms,
    width: a.width,
    height: a.height,
    title: (intakes ?? []).find((i) => i.intake_id === a.intake_id)?.title ?? null,
  }));

  return { mural, scenes, availableAssets };
}

export default async function CuratePage({
  searchParams,
}: {
  searchParams: Promise<{ universe?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { universe } = await searchParams;
  const { media, universes } = await loadCurateStudioMedia();
  const selectedUniverseId = universe && universes.some((item) => item.master_id === universe)
    ? universe
    : null;
  const selected = universes.find((item) => item.master_id === selectedUniverseId) ?? null;
  const inspection = await loadInspectionContext(
    selectedUniverseId,
    universes.map((item) => item.master_id),
  );

  const breadcrumb = selected
    ? [
        { label: "Authority", href: "/authority" },
        { label: "Curate", href: CURATE_STUDIO_HREF },
        { label: selected.title ?? "Untitled universe" },
      ]
    : [
        { label: "Authority", href: "/authority" },
        { label: "Curate" },
      ];

  return (
    <div className="space-y-10">
      <HierarchyBreadcrumb items={breadcrumb} />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Curate Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Curate</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Inspect incoming media, then assemble the canonical work in Creative Suite.
          Uploading media does not create a Universe. Sentinel verifies technical usability.
          Creative meaning, publication, and Experience remain separate steps.
        </p>
        <p className="text-xs text-muted-foreground">
          {CURATE_LIFECYCLE.join(" → ")}
        </p>
      </div>

      <CurateStudioGateway
        media={media}
        universes={universes}
        selectedUniverseId={selectedUniverseId}
      />

      {selectedUniverseId && (
        <section className="space-y-4" aria-labelledby="curate-sentinel">
          <div className="space-y-1">
            <h2 id="curate-sentinel" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Inspect / Sentinel
            </h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Evidence only. Sentinel does not decide Universe, Mural, Scene, contributor, or publication.
            </p>
          </div>
          <CurateClient
            mural={inspection.mural}
            scenes={inspection.scenes}
            availableAssets={inspection.availableAssets}
          />
        </section>
      )}
    </div>
  );
}

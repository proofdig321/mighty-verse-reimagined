export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import SceneDeckClient from "@/components/scene-deck-client";
import { buttonVariants } from "@/components/ui/button";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
  playback_id: string | null;
  provider: string | null;
  start_ms: number | null;
  end_ms: number | null;
};

async function getData(masterId: string): Promise<{ universeTitle: string | null; scenes: SceneItem[] }> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", masterId)
    .single();
  if (!master || master.canonical_type !== "universe") return { universeTitle: null, scenes: [] };

  const { data: pres } = await svc
    .from("work_presentation")
    .select("title")
    .eq("master_id", masterId)
    .maybeSingle();

  // Scenes live inside murals — find mural children, then their scene children
  const { data: muralMasters } = await svc
    .from("master")
    .select("master_id")
    .eq("parent_master_id", masterId)
    .eq("canonical_type", "mural")
    .not("current_state_id", "is", null);

  const muralIds = (muralMasters ?? []).map((m) => m.master_id);
  if (!muralIds.length) return { universeTitle: pres?.title ?? null, scenes: [] };

  const { data: sceneChildren } = await svc
    .from("master")
    .select("master_id, parent_master_id, sort_order")
    .in("parent_master_id", muralIds)
    .eq("canonical_type", "scene")
    .not("current_state_id", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const sceneIds = (sceneChildren ?? []).map((s) => s.master_id);
  if (!sceneIds.length) return { universeTitle: pres?.title ?? null, scenes: [] };

  // Fetch scene presentations, scene projections, and mural projections in parallel
  const muralProjectionQuery = svc
    .from("projection")
    .select("master_id, projection_id")
    .in("master_id", muralIds)
    .eq("projection_type", "experiential");

  const [{ data: scenePres }, { data: sceneProjs }, { data: muralProjs }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
    svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
    muralProjectionQuery,
  ]);

  // Resolve playback_id: try scene's own binding first, fall back to parent mural's binding
  const allProjectionIds = [
    ...(sceneProjs ?? []).map((p) => p.projection_id),
    ...(muralProjs ?? []).map((p) => p.projection_id),
  ];
  const { data: bindings } = allProjectionIds.length
    ? await svc.from("projection_media_binding").select("projection_id, asset_id, start_ms, end_ms").in("projection_id", allProjectionIds).eq("binding_type", "primary").eq("access_level", "public")
    : { data: [] };
  const assetIds = (bindings ?? []).map((b) => b.asset_id);
  const { data: assets } = assetIds.length
    ? await svc.from("media_asset").select("asset_id, storage_ref, provider").in("asset_id", assetIds)
    : { data: [] };

  // Build a map: mural_master_id → { playback_id, provider }
  const muralPlaybackMap = new Map<string, { playback_id: string; provider: string | null }>();
  for (const mp of muralProjs ?? []) {
    const assetId = (bindings ?? []).find((b) => b.projection_id === mp.projection_id)?.asset_id;
    const asset = (assets ?? []).find((a) => a.asset_id === assetId);
    if (asset?.storage_ref && !asset.storage_ref.startsWith("seed:placeholder:")) {
      muralPlaybackMap.set(mp.master_id, { playback_id: asset.storage_ref, provider: asset.provider ?? null });
    }
  }

  // Build a map: scene_master_id → parent_mural_id (already in sceneChildren)
  const sceneMuralMap = new Map<string, string>();
  for (const sc of sceneChildren ?? []) {
    if (sc.parent_master_id) sceneMuralMap.set(sc.master_id, sc.parent_master_id);
  }

  return {
    universeTitle: pres?.title ?? null,
    scenes: sceneIds.map((id) => {
      const projId = (sceneProjs ?? []).find((p) => p.master_id === id)?.projection_id ?? null;
      const binding = (bindings ?? []).find((row) => row.projection_id === projId);
      const asset = (assets ?? []).find((row) => row.asset_id === binding?.asset_id);
      const ownRef = asset?.storage_ref && !asset.storage_ref.startsWith("seed:placeholder:")
        ? asset.storage_ref
        : null;
      const muralId = sceneMuralMap.get(id);
      const muralFallback = muralId ? muralPlaybackMap.get(muralId) ?? null : null;
      return {
        master_id: id,
        title: (scenePres ?? []).find((p) => p.master_id === id)?.title ?? null,
        projection_id: projId,
        playback_id: ownRef ?? muralFallback?.playback_id ?? null,
        provider: ownRef ? (asset?.provider ?? null) : muralFallback?.provider ?? null,
        start_ms: binding?.start_ms ?? null,
        end_ms: binding?.end_ms ?? null,
      };
    }),
  };
}

export default async function UniverseScenesPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const { universeTitle, scenes } = await getData(masterId);
  if (universeTitle === null && scenes.length === 0) notFound();

  return (
    <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <Link
                href={`/worlds/${masterId}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Universe{universeTitle ? ` · ${universeTitle}` : ""}
              </Link>
              <h1
                className="text-3xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                Scene Deck
              </h1>
              <p className="text-sm text-muted-foreground">
                Reveal the Scenes of this Universe. Shuffle is presentation, not canonical order. Create your own timeline.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/editor" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Build Experience →
              </Link>
              <Link href={`/worlds/${masterId}/holographic`} className={buttonVariants({ size: "lg" })} data-experience-entry="experience">
                Enter Experience
              </Link>
            </div>
          </div>
        <SceneDeckClient scenes={scenes} hideHeader faceDownUntilSelected={false} />
    </div>
  );
}

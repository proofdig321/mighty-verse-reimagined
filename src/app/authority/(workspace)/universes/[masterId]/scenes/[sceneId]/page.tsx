export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ProductionBriefs } from "@/components/assemble/production-briefs";
import { StudioPreview } from "@/components/assemble/studio-preview";
import { StudioScenesWorkspace } from "@/components/assemble/studio-scenes-workspace";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";
import { suiteScenes } from "@/lib/assemble/suite";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { composeExperienceProjection } from "@/lib/production/projection";

export default async function UniverseSceneWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string; sceneId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { masterId, sceneId } = await params;
  const query = await searchParams;
  const fromCurate = query.from === "curate";
  const workspace = await requireStudioWorkspace(masterId, fromCurate);
  const scenes = suiteScenes(workspace.data);
  const scene = scenes.find((row) => row.master_id === sceneId);
  if (!scene) notFound();
  const title = workspace.data.title ?? "Untitled universe";
  const layers = composeExperienceProjection({
    canonical_layers: (workspace.intelligence?.holographic ?? []).filter(
      (layer) =>
        layer.kind === "mural" ||
        layer.master_id === sceneId ||
        layer.related_scene_ids.includes(sceneId),
    ),
    realizations: workspace.productionLayers.filter((layer) => layer.scene_master_id === sceneId),
  }).layers;

  return (
    <StudioWorkspaceShell
      universeId={workspace.data.master_id}
      title={title}
      current="scenes"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel={sceneShortTitle(scene.title) ?? scene.title ?? "Scene"}
    >
      <div className="suite-stack">
        <StudioScenesWorkspace
          data={workspace.data}
          canAuthorPresence
          canAuthorIdentity
          canAuthorTiming
          canAuthorOrder
          focusSceneId={sceneId}
          fromCurate={fromCurate}
        />
        <section className="suite-section" aria-labelledby="scene-production">
          <div className="suite-section-head">
            <h2 id="scene-production" className="suite-section-title">
              Production
            </h2>
          </div>
          <ProductionBriefs
            universeId={workspace.data.master_id}
            briefs={workspace.productionBriefs.filter((brief) => brief.scene_master_id === sceneId)}
            proofExecutorAvailable={workspace.proofExecutorAvailable}
          />
        </section>
        <section className="suite-section" aria-labelledby="universe-preview">
          <div className="suite-section-head">
            <h2 id="universe-preview" className="suite-section-title">
              2.5D Preview
            </h2>
          </div>
          <StudioPreview
            universeTitle={scene.title ?? title}
            scenes={[scene]}
            layers={layers}
            experienceHref={`/worlds/${workspace.data.master_id}/holographic`}
            universeHref={`/worlds/${workspace.data.master_id}`}
            source={workspace.source}
            universeId={workspace.data.master_id}
          />
        </section>
      </div>
    </StudioWorkspaceShell>
  );
}

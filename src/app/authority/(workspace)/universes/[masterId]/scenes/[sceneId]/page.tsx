export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ProductionBriefs } from "@/components/assemble/production-briefs";
import { StudioPreview } from "@/components/assemble/studio-preview";
import { StudioSection } from "@/components/assemble/studio-section";
import { StudioScenesWorkspace } from "@/components/assemble/studio-scenes-workspace";
import { StudioWorkspaceShell, studioShellFromWorkspace } from "@/components/assemble/studio-workspace-shell";
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
  const s = scene!;
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
      {...studioShellFromWorkspace(
        workspace,
        "scenes",
        sceneShortTitle(s.title) ?? s.title ?? "Scene",
      )}
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
          muxPlaybackId={workspace.source?.provider === "mux" ? workspace.source.playback_id : null}
          durationMs={workspace.source?.duration_ms}
        />
        <StudioSection id="scene-production" label="Production">
          <ProductionBriefs
            universeId={workspace.data.master_id}
            briefs={workspace.productionBriefs.filter((brief) => brief.scene_master_id === sceneId)}
            proofExecutorAvailable={workspace.proofExecutorAvailable}
          />
        </StudioSection>
        <StudioSection id="universe-preview" label="2.5D Preview">
          <StudioPreview
            universeTitle={s.title ?? title}
            scenes={[s]}
            layers={layers}
            experienceHref={`/worlds/${workspace.data.master_id}/holographic`}
            universeHref={`/worlds/${workspace.data.master_id}`}
            source={workspace.source}
            universeId={workspace.data.master_id}
            moments={workspace.data.creative_moments}
          />
        </StudioSection>
      </div>
    </StudioWorkspaceShell>
  );
}

export const dynamic = "force-dynamic";

import { StudioPreview } from "@/components/assemble/studio-preview";
import { StudioSection } from "@/components/assemble/studio-section";
import { StudioWorkspaceShell, studioShellFromWorkspace } from "@/components/assemble/studio-workspace-shell";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";
import { suiteScenes } from "@/lib/assemble/suite";
import { composeExperienceProjection } from "@/lib/production/projection";

export default async function UniversePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { masterId } = await params;
  const query = await searchParams;
  const fromCurate = query.from === "curate";
  const workspace = await requireStudioWorkspace(masterId, fromCurate);
  const title = workspace.data.title ?? "Untitled universe";
  const layers = composeExperienceProjection({
    canonical_layers: workspace.intelligence?.holographic ?? [],
    realizations: workspace.productionLayers,
  }).layers;

  return (
    <StudioWorkspaceShell {...studioShellFromWorkspace(workspace, "preview", "2.5D Preview")}>
      <StudioSection id="universe-preview" label="2.5D Preview">
        <StudioPreview
          universeTitle={title}
          scenes={suiteScenes(workspace.data)}
          layers={layers}
          experienceHref={`/worlds/${workspace.data.master_id}/holographic`}
          universeHref={`/worlds/${workspace.data.master_id}`}
          source={workspace.source}
          universeId={workspace.data.master_id}
          moments={workspace.data.creative_moments}
        />
      </StudioSection>
    </StudioWorkspaceShell>
  );
}

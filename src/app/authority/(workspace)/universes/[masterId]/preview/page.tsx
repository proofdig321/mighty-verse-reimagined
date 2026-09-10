export const dynamic = "force-dynamic";

import { StudioPreview } from "@/components/assemble/studio-preview";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
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
    <StudioWorkspaceShell
      universeId={workspace.data.master_id}
      title={title}
      current="preview"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="2.5D"
    >
      <section className="suite-section" aria-labelledby="universe-preview">
        <div className="suite-section-head">
          <h2 id="universe-preview" className="suite-section-title">
            2.5D Preview
          </h2>
        </div>
        <StudioPreview
          universeTitle={title}
          scenes={suiteScenes(workspace.data)}
          layers={layers}
          experienceHref={`/worlds/${workspace.data.master_id}/holographic`}
          universeHref={`/worlds/${workspace.data.master_id}`}
          source={workspace.source}
          universeId={workspace.data.master_id}
        />
      </section>
    </StudioWorkspaceShell>
  );
}

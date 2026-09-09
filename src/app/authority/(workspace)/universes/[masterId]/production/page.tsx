export const dynamic = "force-dynamic";

import { ProductionBriefs } from "@/components/assemble/production-briefs";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseProductionPage({
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

  return (
    <StudioWorkspaceShell
      universeId={workspace.data.master_id}
      title={title}
      current="production"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Production"
      lead="Production turns storyboard intent into executable media work. Mux stays the infrastructure — playback IDs live in technical details."
    >
      <section className="suite-section" aria-labelledby="universe-production">
        <div className="suite-section-head">
          <h2 id="universe-production" className="suite-section-title">
            Production
          </h2>
          <p className="suite-section-note">
            Scene-centric instruction layer. A production plan is not a Scene and not canonical truth.
          </p>
        </div>
        <ProductionBriefs
          universeId={workspace.data.master_id}
          briefs={workspace.productionBriefs}
          proofExecutorAvailable={workspace.proofExecutorAvailable}
        />
      </section>
    </StudioWorkspaceShell>
  );
}

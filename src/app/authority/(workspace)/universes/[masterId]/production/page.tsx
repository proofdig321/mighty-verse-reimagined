export const dynamic = "force-dynamic";

import { ProductionBriefs } from "@/components/assemble/production-briefs";
import { StudioSection } from "@/components/assemble/studio-section";
import { StudioWorkspaceShell, studioShellFromWorkspace } from "@/components/assemble/studio-workspace-shell";
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

  return (
    <StudioWorkspaceShell {...studioShellFromWorkspace(workspace, "production", "Production")}>
      <StudioSection id="universe-production" label="Production">
        <ProductionBriefs
          universeId={workspace.data.master_id}
          briefs={workspace.productionBriefs}
          proofExecutorAvailable={workspace.proofExecutorAvailable}
        />
      </StudioSection>
    </StudioWorkspaceShell>
  );
}

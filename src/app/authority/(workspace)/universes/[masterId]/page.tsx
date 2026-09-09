export const dynamic = "force-dynamic";

import { RegisterMural } from "@/components/assemble/register-mural";
import { StudioOverview } from "@/components/assemble/studio-overview";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { MuralEmpty } from "@/components/assemble/mural-presence";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseStudioOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ identity?: string; from?: string }>;
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
      description={workspace.data.description}
      current="overview"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      lead="What are you looking at, what can you create, and what happens next. Each workspace is a page — not a stacked database dump."
    >
      {query.identity === "saved" ? (
        <p role="status" className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          Universe identity saved.
        </p>
      ) : null}
      <StudioOverview
        workspace={workspace}
        muralEmptyAction={
          <MuralEmpty>
            <RegisterMural
              universeId={workspace.data.master_id}
              universeTitle={workspace.data.title}
              fromCurate={fromCurate}
            />
          </MuralEmpty>
        }
      />
    </StudioWorkspaceShell>
  );
}

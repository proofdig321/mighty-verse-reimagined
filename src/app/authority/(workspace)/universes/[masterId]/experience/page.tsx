export const dynamic = "force-dynamic";

import { ExperienceContinuation } from "@/components/assemble/experience-continuation";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseExperiencePage({
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
      current="experience"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Experience"
    >
      <ExperienceContinuation
        href={`/worlds/${workspace.data.master_id}/holographic`}
        universeHref={`/worlds/${workspace.data.master_id}`}
        universeTitle={title}
      />
    </StudioWorkspaceShell>
  );
}

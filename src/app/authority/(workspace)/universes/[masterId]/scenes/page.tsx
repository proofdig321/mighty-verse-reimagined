export const dynamic = "force-dynamic";

import { StudioScenesWorkspace } from "@/components/assemble/studio-scenes-workspace";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseScenesPage({
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
      current="scenes"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Scenes"
      lead="Canonical Scene authoring. Public Scene Deck shuffle remains presentation-only and does not mutate this order."
    >
      <StudioScenesWorkspace
        data={workspace.data}
        canAuthorPresence
        canAuthorIdentity
        canAuthorTiming
        canAuthorOrder
      />
    </StudioWorkspaceShell>
  );
}

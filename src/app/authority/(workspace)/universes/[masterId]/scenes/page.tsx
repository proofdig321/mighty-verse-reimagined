export const dynamic = "force-dynamic";

import { StudioScenesWorkspace } from "@/components/assemble/studio-scenes-workspace";
import { StudioWorkspaceShell, studioShellFromWorkspace } from "@/components/assemble/studio-workspace-shell";
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

  return (
    <StudioWorkspaceShell {...studioShellFromWorkspace(workspace, "scenes", "Scenes")}>
      <StudioScenesWorkspace
        data={workspace.data}
        canAuthorPresence
        canAuthorIdentity
        canAuthorTiming
        canAuthorOrder
        fromCurate={fromCurate}
      />
    </StudioWorkspaceShell>
  );
}

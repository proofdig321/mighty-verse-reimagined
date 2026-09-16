export const dynamic = "force-dynamic";

import { SentinelEvidencePage } from "@/components/assemble/sentinel-evidence-page";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { mediaInspectHref, creativeSuiteWorkspaceHref, curateSentinelHref } from "@/lib/assemble/studio";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseSentinelPage({
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
  const from = fromCurate ? "curate" : null;

  return (
    <StudioWorkspaceShell
      universeId={workspace.data.master_id}
      title={title}
      current="sentinel"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Sentinel"
    >
      <SentinelEvidencePage
        universeId={workspace.data.master_id}
        universeTitle={title}
        intelligence={workspace.intelligence}
        canAuthoriseSentinel
        inspectHref={workspace.inspectAssetId ? mediaInspectHref(workspace.inspectAssetId) : null}
        previewHref={creativeSuiteWorkspaceHref(workspace.data.master_id, "preview", from)}
        establishHref={curateSentinelHref(workspace.data.master_id)}
      />
    </StudioWorkspaceShell>
  );
}

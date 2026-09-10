export const dynamic = "force-dynamic";

import { StoryboardWorkspace } from "@/components/assemble/storyboard-workspace";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
import { mediaInspectHref, creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { suiteScenes } from "@/lib/assemble/suite";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { serverAiCapability } from "@/lib/ai/provider";
import { requireStudioWorkspace } from "@/lib/assemble/studio-session";

export default async function UniverseStoryboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ from?: string; source?: string }>;
}) {
  const { masterId } = await params;
  const query = await searchParams;
  const fromCurate = query.from === "curate";
  const workspace = await requireStudioWorkspace(masterId, fromCurate);
  const title = workspace.data.title ?? "Untitled universe";
  const from = fromCurate ? "curate" : null;
  const materials = await loadStoryboardMaterials(workspace.data.master_id);
  const ai = serverAiCapability();

  return (
    <StudioWorkspaceShell
      universeId={workspace.data.master_id}
      title={title}
      current="storyboard"
      suiteHref={workspace.suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Storyboard"
    >
      <StoryboardWorkspace
        universeId={workspace.data.master_id}
        universeTitle={title}
        scenes={suiteScenes(workspace.data)}
        intelligence={workspace.intelligence}
        canAuthoriseSentinel
        inspectHref={workspace.inspectAssetId ? mediaInspectHref(workspace.inspectAssetId) : null}
        previewHref={creativeSuiteWorkspaceHref(workspace.data.master_id, "preview", from)}
        references={workspace.references}
        initialTab={query.source === "sentinel" ? "sentinel" : "script"}
        initialBody={materials.body?.body ?? ""}
        artifacts={materials.artifacts.map((artifact) => ({
          title: artifact.title,
          output_type: artifact.output_type,
          still_url: artifact.still_url,
          status: artifact.playback_id || artifact.still_url ? "ready" : "failed",
        }))}
        assistConfigured={ai.text}
      />
    </StudioWorkspaceShell>
  );
}

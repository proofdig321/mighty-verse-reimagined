export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { StoryboardWorkspace } from "@/components/assemble/storyboard-workspace";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { serverAiCapability } from "@/lib/ai/provider";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";
import type { WorkbenchPanel } from "@/components/assemble/studio-workbench-nav";

export default async function StudioWorkEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ source?: string; panel?: string; viewport?: string }>;
}) {
  const { workId } = await params;
  const { source, panel, viewport } = await searchParams;
  const { participantId } = await requireStudioUser(`/studio/work/${workId}`);

  // When arriving from Gallery with a source asset, redirect to the dedicated
  // source workflow route so the user enters a proper workflow, not a tab.
  if (source) {
    redirect(`/studio/work/${workId}/source?from=/gallery/${source}`);
  }

  const validPanels: WorkbenchPanel[] = ["work", "create", "results"];
  const activePanel = validPanels.includes(panel as WorkbenchPanel)
    ? (panel as WorkbenchPanel)
    : viewport === "mobile"
      ? "mobile"
      : "work";

  const [materials, projects, work] = await Promise.all([
    loadStoryboardMaterials(null, participantId),
    loadUniverseProjectCards(),
    loadStoryboardWorkById({ workId, participantId }),
  ]);
  const ai = serverAiCapability();

  return (
    <div className="space-y-6">
      <StoryboardWorkspace
        universeId={work?.universe_id ?? null}
        universeTitle={work?.title ?? "Untitled storyboard"}
        scenes={[]}
        intelligence={null}
        canAuthoriseSentinel={false}
        previewHref={`/studio/work/${workId}/preview`}
        references={(work?.frames ?? []).map((frame) => ({
          asset_id: `${frame.playback_id}:${frame.timestamp_ms}`,
          title: frame.source_title,
          role: "still",
          time_ms: frame.timestamp_ms,
          still_url: frame.still_url,
        }))}
        initialBody={work?.body ?? materials.body?.body ?? ""}
        initialCreativeIntent={work?.creative_intent ?? ""}
        artifacts={materials.artifacts.map((artifact) => ({
          title: artifact.title,
          output_type: artifact.output_type,
          still_url: artifact.still_url,
          status: artifact.playback_id || artifact.still_url ? "ready" : "failed",
        }))}
        assistConfigured={ai.text}
        universes={projects.map((project) => ({ master_id: project.master_id, title: project.title }))}
        workId={workId}
        backHref="/studio/work"
        activePanel={activePanel}
        mobileView={viewport === "mobile"}
      />
    </div>
  );
}

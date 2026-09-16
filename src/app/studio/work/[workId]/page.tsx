export const dynamic = "force-dynamic";

import { StoryboardWorkspace } from "@/components/assemble/storyboard-workspace";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { serverAiCapability } from "@/lib/ai/provider";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";

export default async function StudioWorkEditorPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const { participantId } = await requireStudioUser(`/studio/work/${workId}`);
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
        previewHref="/studio"
        references={[]}
        initialBody={work?.body ?? materials.body?.body ?? ""}
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
      />
    </div>
  );
}

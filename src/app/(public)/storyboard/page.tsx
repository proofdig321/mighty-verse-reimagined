export const dynamic = "force-dynamic";

import { StoryboardWorkspace } from "@/components/assemble/storyboard-workspace";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { serverAiCapability } from "@/lib/ai/provider";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";

export default async function AudienceStoryboardPage() {
  const { participantId } = await requireStudioUser("/storyboard");
  const [materials, projects] = await Promise.all([
    loadStoryboardMaterials(null, participantId),
    loadUniverseProjectCards(),
  ]);
  const ai = serverAiCapability();

  return (
    <div className="public-page">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Create</p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Storyboard
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Write a story, GENERATE shots from gallery artifacts, and produce a 30-second clip.
            This is an Experience artifact. It does not create Scenes or change canonical timing.
          </p>
        </div>
        <StoryboardWorkspace
          universeId={null}
          scenes={[]}
          intelligence={null}
          canAuthoriseSentinel={false}
          previewHref="/scenes"
          references={[]}
          initialBody={materials.body?.body ?? ""}
          artifacts={materials.artifacts.map((artifact) => ({
            title: artifact.title,
            output_type: artifact.output_type,
            still_url: artifact.still_url,
            status: artifact.playback_id || artifact.still_url ? "ready" : "failed",
          }))}
          assistConfigured={ai.text}
          universes={projects.map((project) => ({ master_id: project.master_id, title: project.title }))}
        />
      </div>
    </div>
  );
}

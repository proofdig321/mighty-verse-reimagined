export const dynamic = "force-dynamic";

import { StoryboardWorkspace } from "@/components/assemble/storyboard-workspace";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { serverAiCapability } from "@/lib/ai/provider";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";

export default async function StudioWorkPage() {
  const { participantId } = await requireStudioUser("/studio/work");
  const [materials, projects] = await Promise.all([
    loadStoryboardMaterials(null, participantId),
    loadUniverseProjectCards(),
  ]);
  const ai = serverAiCapability();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Standalone work</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
          Storyboard Workspace
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Write a story, generate a sequence, and produce media. This work is not attached to a Universe until you curate that relationship.
        </p>
      </div>
      <StoryboardWorkspace
        universeId={null}
        scenes={[]}
        intelligence={null}
        canAuthoriseSentinel={false}
        previewHref="/studio"
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
  );
}

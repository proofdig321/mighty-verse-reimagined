export const dynamic = "force-dynamic";

import { StoryboardWorkList } from "@/components/assemble/storyboard-work-list";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { listStoryboardWorks } from "@/lib/storyboard/commands";

export default async function StudioWorkPage() {
  const { participantId } = await requireStudioUser("/studio/work");
  const [projects, works] = await Promise.all([
    loadUniverseProjectCards(),
    listStoryboardWorks({ participantId }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Standalone work</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
          Storyboard Workspace
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open or create a Storyboard Work. Work stays independent until you attach it. Attachment does not create Scenes.
        </p>
      </div>
      <StoryboardWorkList
        initialWorks={works}
        universes={projects.map((project) => ({ master_id: project.master_id, title: project.title }))}
      />
    </div>
  );
}

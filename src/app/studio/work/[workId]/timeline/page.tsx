export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";
import { StudioWorkbenchNav } from "@/components/assemble/studio-workbench-nav";
import { StoryboardTimelineEditorShell } from "@/components/assemble/storyboard-timeline-editor-shell";

export default async function StoryboardTimelinePage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const { participantId } = await requireStudioUser(`/studio/work/${workId}/timeline`);
  const work = await loadStoryboardWorkById({ workId, participantId });
  if (!work) notFound();

  return (
    <div className="studio-workbench-page">
      <StudioWorkbenchNav workId={workId} active="timeline" />
      <main className="studio-workbench-page-main min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-border/60">
          <Link
            href={`/studio/work/${workId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            Back to work
          </Link>
          <span className="text-muted-foreground/40 text-sm">·</span>
          <span className="suite-kicker">{work.title}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <StoryboardTimelineEditorShell
            workId={workId}
            panels={work.panels}
          />
        </div>
      </main>
    </div>
  );
}

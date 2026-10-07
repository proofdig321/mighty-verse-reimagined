export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AssociateStoryboard } from "@/components/assemble/associate-storyboard";
import { StudioWorkbenchNav } from "@/components/assemble/studio-workbench-nav";
import { StoryboardPreviewPlayer } from "@/components/assemble/storyboard-preview-player";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import {
  storyboardAssociationStatus,
  storyboardAttachmentHint,
  storyboardModeLabel,
  storyboardStatusTone,
  storyboardWorkSummary,
} from "@/lib/storyboard/association";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";

export default async function StoryboardWorkPreviewPage({
  params,
}: {
  params: Promise<{ workId: string }>;
}) {
  const { workId } = await params;
  const { participantId } = await requireStudioUser(`/studio/work/${workId}/preview`);
  const [work, universes] = await Promise.all([
    loadStoryboardWorkById({ workId, participantId }),
    loadUniverseProjectCards(),
  ]);
  if (!work) notFound();

  const associationState = storyboardAssociationStatus(work.universe_id);
  const summary = storyboardWorkSummary({
    universeId: work.universe_id,
    generationStatus: work.status,
    updatedAt: work.updated_at,
    panelCount: work.panels.length,
  });

  const previewPanels = work.panels.map((panel) => ({
    panel_id: panel.panel_id,
    sequence: panel.sequence,
    title: panel.title,
    description: panel.description ?? null,
    still_url: panel.still_url ?? null,
    motion_endpoint: panel.motion_endpoint ?? null,
    motion_playback_id: panel.motion_playback_id ?? null,
  }));

  return (
    <div className="studio-workbench-page studio-workbench-preview-page">
      <StudioWorkbenchNav workId={workId} active="preview" />
      <main className="studio-workbench-page-main mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href={`/studio/work/${workId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft size={14} />
          Back to work
        </Link>

        <header className="space-y-1 border-b border-border/60 pb-4">
          <p className="suite-kicker">Storyboard · Preview</p>
          <h1 className="text-2xl font-semibold">{work.title}</h1>
          {work.body.trim() ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{work.body}</p>
          ) : null}
        </header>

        {/* Visual player — primary surface */}
        <StoryboardPreviewPlayer panels={previewPanels} />

        {/* Association status */}
        <section className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="suite-kicker mb-1">Association</p>
              <p className="text-sm font-medium">{associationState.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.line}</p>
              <p className="text-xs text-muted-foreground">
                {storyboardModeLabel(associationState.attached)} · {storyboardStatusTone(work.status)} · {storyboardAttachmentHint(work.universe_id)}
              </p>
            </div>
            {associationState.required && universes.length > 0 ? (
              <div className="w-full max-w-md">
                <AssociateStoryboard universes={universes} workId={work.work_id} />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

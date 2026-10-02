export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AssociateStoryboard } from "@/components/assemble/associate-storyboard";
import { StoryboardHlsPreview } from "@/components/assemble/storyboard-hls-preview";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { storyboardAssociationStatus, storyboardUpdatedLabel } from "@/lib/storyboard/association";
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

  const panelsWithResults = work.panels.filter((panel) => panel.motion_endpoint || panel.motion_playback_id || panel.still_url);
  const associationState = storyboardAssociationStatus(work.universe_id);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <Link
        href={`/studio/work/${workId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft size={14} />
        Back to work
      </Link>

      <header className="space-y-2 border-b border-border/60 pb-5">
        <p className="text-xs font-medium uppercase text-muted-foreground">Storyboard work · Preview</p>
        <h1 className="text-2xl font-semibold">{work.title}</h1>
        <p className="text-sm text-muted-foreground">
          Review storyboard panels and their generated media. This preview does not publish Scenes or change Universe timing.
        </p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Association</p>
            <p className="text-base font-medium">{associationState.label}</p>
            <p className="text-xs text-muted-foreground">{storyboardUpdatedLabel(work.updated_at)}</p>
          </div>
          {associationState.required && universes.length > 0 ? (
            <div className="w-full max-w-md">
              <AssociateStoryboard universes={universes} workId={work.work_id} />
            </div>
          ) : null}
        </div>
      </section>

      {work.body.trim() ? (
        <section className="max-w-3xl space-y-2" aria-labelledby="preview-story-heading">
          <h2 id="preview-story-heading" className="text-sm font-semibold">Story</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{work.body}</p>
        </section>
      ) : null}

      <section className="space-y-4" aria-labelledby="preview-panels-heading">
        <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
          <h2 id="preview-panels-heading" className="text-sm font-semibold">Storyboard panels</h2>
          <span className="text-xs text-muted-foreground">{work.panels.length} panels</span>
        </div>
        {work.panels.length === 0 ? (
          <p className="text-sm text-muted-foreground">This work does not have storyboard panels yet.</p>
        ) : (
          <ol className="grid gap-5 md:grid-cols-2">
            {work.panels.map((panel) => {
              const endpoint = panel.motion_endpoint ?? (panel.motion_playback_id
                ? `https://stream.mux.com/${panel.motion_playback_id}.m3u8`
                : null);
              return (
                <li key={panel.panel_id} className="min-w-0 space-y-3 border-b border-border/40 pb-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Panel {String(panel.sequence).padStart(2, "0")}</p>
                    <h3 className="text-base font-medium">{panel.title}</h3>
                    {panel.description ? <p className="mt-1 text-sm text-muted-foreground">{panel.description}</p> : null}
                  </div>
                  {endpoint ? (
                    <StoryboardHlsPreview endpoint={endpoint} poster={panel.still_url} label={`${panel.title} preview`} />
                  ) : panel.still_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={panel.still_url} alt={panel.title} className="aspect-video w-full rounded-md border border-border object-contain" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                      No generated media for this panel
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {work.panels.length > 0 && panelsWithResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">Panels are ready for creative review; generated media has not been attached yet.</p>
        ) : null}
      </section>
    </main>
  );
}

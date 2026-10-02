export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadStoryboardWorkById } from "@/lib/storyboard/work";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";
import { playableGallerySources } from "@/lib/assemble/gallery-source";
import { WorkSourceWorkflow } from "@/components/assemble/work-source-workflow";

export default async function WorkSourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { workId } = await params;
  const { from } = await searchParams;
  const { participantId } = await requireStudioUser(`/studio/work/${workId}/source`);

  const [work, studioMedia] = await Promise.all([
    loadStoryboardWorkById({ workId, participantId }),
    loadCurateStudioMedia(),
  ]);

  if (!work) notFound();

  const gallerySources = playableGallerySources(studioMedia.media);

  return (
    <WorkSourceWorkflow
      workId={workId}
      workTitle={work.title}
      sources={work.sources ?? []}
      frames={work.frames ?? []}
      gallerySources={gallerySources}
      returnHref={`/studio/work/${workId}`}
      fromHref={from ?? null}
    />
  );
}

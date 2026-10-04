export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StoryboardWorkList } from "@/components/assemble/storyboard-work-list";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { listStoryboardWorks } from "@/lib/storyboard/commands";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StudioWorkbenchNav } from "@/components/assemble/studio-workbench-nav";

export default async function StudioWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { participantId } = await requireStudioUser("/studio/work");
  const { source } = await searchParams;
  const [projects, works] = await Promise.all([
    loadUniverseProjectCards(),
    listStoryboardWorks({ participantId }),
  ]);

  return (
    <div className="studio-workbench-page">
      <StudioWorkbenchNav workId={null} active="work" />
      <div className="studio-workbench-page-main space-y-6">
      <div className="space-y-2">
        {source && (
          <Link href={`/gallery/${source}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 -ml-2")}>
            <ChevronLeft size={14} />
            Back to source
          </Link>
        )}
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Standalone work</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display, inherit)" }}>
          My Storyboard
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open or create a Storyboard Work. Work stays independent until you attach it. Attachment does not create Scenes.
        </p>
      </div>
      <StoryboardWorkList
        initialWorks={works}
        universes={projects.map((project) => ({ master_id: project.master_id, title: project.title }))}
        sourceAssetId={source ?? null}
      />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Film, MonitorPlay, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseCatalogue } from "@/lib/assemble/load-universe-catalogue";
import { composeStudioLanding } from "@/lib/assemble/studio-landing";
import { studioInteractionLabel } from "@/lib/assemble/studio-interaction";
import { listStoryboardWorks } from "@/lib/storyboard/commands";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StoryboardWorkList } from "@/components/assemble/storyboard-work-list";
import { UniverseProjectList } from "@/components/assemble/universe-project-list";

export default async function StudioHomePage() {
  const supabase = await createClient();
  const participantId = await getParticipantId(supabase);
  const [catalogueResult, works] = await Promise.all([
    loadUniverseCatalogue(),
    participantId ? listStoryboardWorks({ participantId }) : Promise.resolve([]),
  ]);
  const landing = composeStudioLanding(
    catalogueResult.rows.map((project) => ({
      master_id: project.master_id,
      title: project.title ?? "Untitled universe",
      description: project.description,
      occupancy: project.occupancy,
      withdrawable: project.withdrawable,
    })),
    works,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
          Studio
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Creative Studio is a workstation. {studioInteractionLabel()}. Begin with a story or an existing Universe.
          Sentinel observes. Directives stay yours. Generated work stays an artifact until you curate it.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link href="/studio/work">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <Plus size={16} className="text-muted-foreground" />
              <CardTitle>New creative work</CardTitle>
              <CardDescription>Idea-first. Open the script and storyboard workspace.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/authority/create">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <MonitorPlay size={16} className="text-muted-foreground" />
              <CardTitle>Establish a Universe</CardTitle>
              <CardDescription>Source-first. Create Work. YouTube is the primary ingest path.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/authority/curate">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <Film size={16} className="text-muted-foreground" />
              <CardTitle>Curate Hub</CardTitle>
              <CardDescription>Associate ingested media, inspect, then continue in this workstation.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      {landing.standalone.length ? (
        <section className="space-y-3" aria-labelledby="studio-recent">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent creative work</p>
          <h2 id="studio-recent" className="text-xl font-semibold tracking-tight">
            Standalone storyboard
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each unattached Storyboard is its own workspace. Delete removes that workspace only.
          </p>
          <StoryboardWorkList
            initialWorks={landing.standalone.map((item) => item.work)}
            universes={[]}
            standaloneOnly
          />
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="studio-universes">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contextual work</p>
        <h2 id="studio-universes" className="text-xl font-semibold tracking-tight">
          Universe projects
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open an established Universe to compose Storyboard, Scenes, Production, 2.5D Preview, and Experience.
          Edit identity or remove orphan shells here so they do not accumulate. Attached Storyboard stays non-canonical.
          Super Hero Ego cannot be withdrawn.
        </p>
        {landing.universes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Universes yet. Start with an idea, or establish a Universe first.</p>
        ) : (
          <UniverseProjectList projects={landing.universes} />
        )}
      </section>
    </div>
  );
}

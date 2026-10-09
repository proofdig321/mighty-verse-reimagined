export const dynamic = "force-dynamic";

import Link from "next/link";
import { Film, MonitorPlay, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseCatalogue } from "@/lib/assemble/load-universe-catalogue";
import { composeStudioLanding } from "@/lib/assemble/studio-landing";
import { studioInteractionLabel } from "@/lib/assemble/studio-interaction";
import { listStoryboardWorks } from "@/lib/storyboard/commands";
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

      <dl className="studio-command-grid">
        <div className="studio-command-card">
          <Link href="/studio/work">
            <dt className="suite-kicker flex items-center gap-1.5"><Plus size={10} />New creative work</dt>
            <dd className="text-sm font-medium text-foreground mt-1">Storyboard workspace</dd>
            <dd className="text-xs text-muted-foreground mt-0.5">Idea-first. Open the script and storyboard workspace.</dd>
          </Link>
        </div>
        <div className="studio-command-card">
          <Link href="/authority/create">
            <dt className="suite-kicker flex items-center gap-1.5"><MonitorPlay size={10} />Establish a Universe</dt>
            <dd className="text-sm font-medium text-foreground mt-1">Create Work</dd>
            <dd className="text-xs text-muted-foreground mt-0.5">Source-first. YouTube is the primary ingest path.</dd>
          </Link>
        </div>
        <div className="studio-command-card">
          <Link href="/authority/curate">
            <dt className="suite-kicker flex items-center gap-1.5"><Film size={10} />Curate Hub</dt>
            <dd className="text-sm font-medium text-foreground mt-1">Associate media</dd>
            <dd className="text-xs text-muted-foreground mt-0.5">Associate ingested media, inspect, then continue in this workstation.</dd>
          </Link>
        </div>
      </dl>

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

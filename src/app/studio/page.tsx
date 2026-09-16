export const dynamic = "force-dynamic";

import Link from "next/link";
import { Clapperboard, Film, MonitorPlay, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { composeStudioLanding } from "@/lib/assemble/studio-landing";
import { studioInteractionLabel } from "@/lib/assemble/studio-interaction";
import { listStoryboardWorks } from "@/lib/storyboard/commands";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StoryboardWorkList } from "@/components/assemble/storyboard-work-list";

export default async function StudioHomePage() {
  const supabase = await createClient();
  const participantId = await getParticipantId(supabase);
  const [projects, works] = await Promise.all([
    loadUniverseProjectCards(),
    participantId ? listStoryboardWorks({ participantId }) : Promise.resolve([]),
  ]);
  const landing = composeStudioLanding(projects, works);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
          I have an idea
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Creative Studio is a workstation. {studioInteractionLabel()}. Begin with a story or an existing Universe.
          Sentinel observes. Directives stay yours. Generated work stays an artifact until you curate it.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <Link href="/scenes">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <Clapperboard size={16} className="text-muted-foreground" />
              <CardTitle>Scene Deck</CardTitle>
              <CardDescription>Discover, reveal, reorder, then play your own timeline.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/editor">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <Film size={16} className="text-muted-foreground" />
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Public 2.5D assembly. Experience is not a Studio editor.</CardDescription>
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
          Open an established Universe to compose Storyboard, Scenes, Production, 2.5D Experience, and Holographic Experience.
          Attached Storyboard stays non-canonical. This does not replace standalone work.
        </p>
        {landing.universes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Universes yet. Start with an idea, or establish a Universe first.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {landing.universes.map((project) => (
              <li key={project.master_id}>
                <Link href={project.href} aria-label={project.title}>
                  <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
                    <CardHeader>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Universe</p>
                      <CardTitle>{project.title}</CardTitle>
                      {project.description ? (
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {project.attached_work_count
                          ? `${project.attached_work_count} attached storyboard${project.attached_work_count === 1 ? "" : "s"} · non-canonical`
                          : "No attached storyboard"}
                      </p>
                      <span className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Open workspace</span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

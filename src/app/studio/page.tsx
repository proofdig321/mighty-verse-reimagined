export const dynamic = "force-dynamic";

import Link from "next/link";
import { Clapperboard, Film, MonitorPlay, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function StudioHomePage() {
  const projects = await loadUniverseProjectCards();
  const supabase = await createClient();
  const participantId = await getParticipantId(supabase);
  const recent = participantId ? await loadStoryboardMaterials(null, participantId) : { body: null, artifacts: [] };
  const hasStandalone = Boolean(recent.body || recent.artifacts.length);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
          I have an idea
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Creative Studio is a workstation. Begin with a story, a campaign, a reel, or an existing Universe.
          Generated work stays an artifact until you curate it.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/studio/work">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <Plus size={16} className="text-muted-foreground" />
              <CardTitle>New creative work</CardTitle>
              <CardDescription>Open the script and storyboard workspace.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/authority/create">
          <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
            <CardHeader>
              <MonitorPlay size={16} className="text-muted-foreground" />
              <CardTitle>Establish a Universe</CardTitle>
              <CardDescription>Create Work. YouTube is the primary ingest path.</CardDescription>
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
              <CardDescription>Build Experience with the original timeline player.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      {hasStandalone ? (
        <section className="space-y-3" aria-labelledby="studio-recent">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent creative work</p>
          <h2 id="studio-recent" className="text-xl font-semibold tracking-tight">
            Standalone storyboard
          </h2>
          <Link href="/studio/work" className="block max-w-xl">
            <Card className="bg-card/80 transition-colors hover:bg-accent/20">
              <CardHeader>
                <CardTitle>Continue standalone work</CardTitle>
                <CardDescription>
                  {recent.body ? `${recent.body.panel_count || 0} panels` : "Story body in progress"}
                  {recent.artifacts.length ? ` · ${recent.artifacts.length} artifacts` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="studio-universes">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contextual work</p>
        <h2 id="studio-universes" className="text-xl font-semibold tracking-tight">
          Universe projects
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open an established Universe to compose Storyboard, Scenes, Production, 2.5D, and Experience. This does not replace standalone work.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Universes yet. Start with an idea, or establish a Universe first.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.master_id}>
                <Link href={`/authority/universes/${project.master_id}`} aria-label={project.title}>
                  <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
                    <CardHeader>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Universe</p>
                      <CardTitle>{project.title}</CardTitle>
                      {project.description ? (
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent>
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

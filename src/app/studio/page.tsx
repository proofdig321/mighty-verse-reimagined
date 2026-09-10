export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseProjectCards } from "@/lib/assemble/load-universe";
import { loadStoryboardMaterials } from "@/lib/storyboard/load";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function StudioHomePage() {
  const projects = await loadUniverseProjectCards();
  const supabase = await createClient();
  const participantId = await getParticipantId(supabase);
  const recent = participantId ? await loadStoryboardMaterials(null, participantId) : { body: null, artifacts: [] };
  const hasStandalone = Boolean(recent.body || recent.artifacts.length);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Start</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display, inherit)" }}>
          I have an idea
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Creative Studio is a workstation. Begin with a story, a campaign, a reel, or an existing Universe.
          Generated work stays an artifact until you curate it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio/work" className={cn(buttonVariants({ size: "lg" }))}>
            New creative work
          </Link>
          <Link href="/authority/create" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Establish a Universe
          </Link>
        </div>
      </section>

      {hasStandalone ? (
        <section className="space-y-3" aria-labelledby="studio-recent">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent creative work</p>
          <h2 id="studio-recent" className="text-xl font-semibold tracking-tight">
            Standalone storyboard
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This work is not attached to a Universe yet. Open it to continue, or associate it when you are ready to curate.
          </p>
          <Link href="/studio/work" className="block max-w-xl rounded-lg border border-border bg-card/40 p-4 transition-colors hover:bg-card">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Storyboard</p>
            <p className="mt-1 text-base font-medium text-foreground">Continue standalone work</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recent.body ? `${recent.body.panel_count || 0} panels` : "Story body in progress"}
              {recent.artifacts.length ? ` · ${recent.artifacts.length} artifacts` : ""}
            </p>
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
                <Link
                  href={`/authority/universes/${project.master_id}`}
                  aria-label={project.title}
                  className="block rounded-lg border border-border bg-card/40 p-4 transition-colors hover:bg-card"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Universe</p>
                  <p className="mt-1 text-base font-medium text-foreground">{project.title}</p>
                  {project.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

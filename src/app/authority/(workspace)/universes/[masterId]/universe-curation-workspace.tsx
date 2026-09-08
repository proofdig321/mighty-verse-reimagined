import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatTimelineMs } from "../../_shared/authority-utils";

export type UniverseCurationScene = {
  master_id: string;
  title: string | null;
  sort_order: number | null;
  start_ms: number | null;
  end_ms: number | null;
  projection_id: string | null;
  creative_moment_id: string | null;
  creative_moment_title: string | null;
};

export type UniverseCurationMural = {
  master_id: string;
  title: string | null;
  scenes: UniverseCurationScene[];
};

export type UniverseCurationMoment = {
  master_id: string;
  title: string | null;
  has_experience: boolean;
  scene_titles: string[];
};

export type UniverseCurationData = {
  master_id: string;
  title: string | null;
  description: string | null;
  created_at: string;
  murals: UniverseCurationMural[];
  creative_moments: UniverseCurationMoment[];
};

function untitled(kind: string) {
  return <span className="italic text-muted-foreground">Untitled {kind}</span>;
}

export default function UniverseCurationWorkspace({ data }: { data: UniverseCurationData }) {
  const title = data.title ?? "Untitled universe";
  const sceneCount = data.murals.reduce((n, mural) => n + mural.scenes.length, 0);
  const recordHref = `/authority/${data.master_id}`;
  const publicHref = `/worlds/${data.master_id}`;

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/authority" className="hover:text-foreground transition-colors">
          Authority
        </Link>
        <span className="opacity-30">/</span>
        <Link href="/authority/universes" className="hover:text-foreground transition-colors">
          Universes
        </Link>
        <span className="opacity-30">/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Universe curation
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Assemble this Universe from its canonical Mural, Scenes, and Creative Moments.
            Editing those layers is added in later increments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={publicHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View public experience
          </Link>
          <Link href={recordHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Canonical record
          </Link>
        </div>
      </div>

      <section className="space-y-3" aria-labelledby="universe-identity">
        <h2 id="universe-identity" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Identity
        </h2>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-card px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Title</p>
            <p className="mt-2 text-sm font-medium text-foreground">{data.title ?? untitled("universe")}</p>
          </div>
          <div className="bg-card px-5 py-4 sm:col-span-2 xl:col-span-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Description</p>
            <p className="mt-2 text-sm text-foreground/80">
              {data.description ?? <span className="italic text-muted-foreground">No description yet.</span>}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Master</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground break-all">{data.master_id}</p>
            <p className="mt-2 text-[11px] text-muted-foreground/70">Created {data.created_at.slice(0, 10)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {[
          { label: "Murals", value: data.murals.length },
          { label: "Scenes", value: sceneCount },
          { label: "Creative Moments", value: data.creative_moments.length },
        ].map((item) => (
          <div key={item.label} className="bg-card px-5 py-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3" aria-labelledby="universe-mural">
        <div className="flex items-end justify-between gap-4">
          <h2 id="universe-mural" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Mural
          </h2>
        </div>
        {data.murals.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card/30 px-5 py-6">
            No mural assembled for this Universe yet.
          </p>
        ) : (
          <div className="space-y-6">
            {data.murals.map((mural) => (
              <div key={mural.master_id} className="rounded-lg border border-border overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {mural.title ?? untitled("mural")}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground break-all">{mural.master_id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{mural.scenes.length} scene{mural.scenes.length === 1 ? "" : "s"}</Badge>
                    <Link
                      href={`/authority/${mural.master_id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Open record
                    </Link>
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Scenes
                  </h3>
                </div>
                {mural.scenes.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No scenes assembled on this Mural yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/10">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Scene</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Timing</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Creative Moment</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mural.scenes.map((scene) => (
                        <tr key={scene.master_id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {scene.title ?? untitled("scene")}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">
                            {scene.start_ms != null && scene.end_ms != null
                              ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
                              : <span className="font-sans italic text-muted-foreground/50">Not set</span>}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                            {scene.creative_moment_title ?? <span className="italic text-muted-foreground/50">Not related</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/authority/${scene.master_id}`}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Open record
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="universe-moments">
        <h2 id="universe-moments" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Creative Moments
        </h2>
        {data.creative_moments.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card/30 px-5 py-6">
            No Creative Moments assembled in this Universe yet.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Creative Moment</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Related Scenes</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Experience</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.creative_moments.map((moment) => (
                  <tr key={moment.master_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {moment.title ?? untitled("moment")}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {moment.scene_titles.length > 0
                        ? moment.scene_titles.join(" · ")
                        : <span className="italic text-muted-foreground/50">No Scene relation</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {moment.has_experience
                        ? <Badge variant="secondary">Created</Badge>
                        : <Badge variant="outline">Identity only</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/authority/${moment.master_id}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Open record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

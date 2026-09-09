import { sceneShortTitle } from "@/lib/assemble/composition";
import { formatTimelineMs } from "@/lib/media/timing";
import type { SceneProductionBrief } from "@/lib/production/plan";

export function ProductionBriefs({ briefs }: { briefs: SceneProductionBrief[] }) {
  if (briefs.length === 0) {
    return (
      <p className="suite-empty">
        Production plans appear here once this Universe has canonical Scenes.
      </p>
    );
  }

  return (
    <ol className="suite-scene-grid">
      {briefs.map((brief) => (
        <li key={brief.scene_master_id}>
          <article
            className="rounded-lg border border-border bg-card/40 px-4 py-4 space-y-3"
            data-production-scene={brief.scene_master_id}
            data-production-status={brief.status}
          >
            <p className="suite-kicker">Production plan</p>
            <h3 className="text-base font-medium text-foreground">
              {sceneShortTitle(brief.title) ?? brief.title ?? "Untitled Scene"}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">{brief.window_label}</p>
            <p className="suite-proposal-badge">Planning</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Creative Moments</dt>
                <dd className="text-foreground">
                  {brief.moments.length
                    ? brief.moments.map((moment) => moment.title ?? "Untitled").join(" · ")
                    : "None related"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Storyboard</dt>
                <dd className="text-muted-foreground">
                  {brief.storyboard_count > 0
                    ? `${brief.storyboard_count} derived panel${brief.storyboard_count === 1 ? "" : "s"} in Sentinel`
                    : "No derived panels yet"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">References</dt>
                <dd className="text-foreground">
                  {brief.references.length === 0
                    ? "None retained yet. Keep a Sentinel still as a reference to attach it here."
                    : brief.references
                        .map((reference) => `${reference.role} · ${formatTimelineMs(reference.time_ms)}`)
                        .join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Visual intention</dt>
                <dd className="text-muted-foreground">{brief.visual_intention}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Motion / transition</dt>
                <dd className="text-muted-foreground">
                  {brief.motion} · {brief.transition}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Output</dt>
                <dd className="text-muted-foreground">{brief.output_target}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Realization</dt>
                <dd className="text-muted-foreground">
                  No production realization yet. External AI/MCP execution is not connected.
                </dd>
              </div>
            </dl>
            {brief.references.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {brief.references.map((reference) => (
                  <li key={reference.asset_id} className="w-28">
                    {reference.still_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={reference.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                    ) : (
                      <div className="aspect-video rounded bg-muted/40" />
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">{reference.role}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

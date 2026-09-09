"use client";

import { useState } from "react";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { Button } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import type { SceneProductionBrief } from "@/lib/production/plan";

export function ProductionBriefs({
  universeId,
  briefs,
}: {
  universeId: string;
  briefs: SceneProductionBrief[];
}) {
  const [busyScene, setBusyScene] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function execute(sceneMasterId: string) {
    setBusyScene(sceneMasterId);
    setNote(null);
    try {
      const response = await fetch("/api/authority/production/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe_id: universeId,
          scene_master_id: sceneMasterId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload.error === "string"
          ? payload.error
          : "Production execution could not be dispatched.";
      setNote(message);
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "Production execution could not be dispatched.");
    } finally {
      setBusyScene(null);
    }
  }

  if (briefs.length === 0) {
    return (
      <p className="suite-empty">
        Production plans appear here once this Universe has canonical Scenes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {note ? (
        <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          {note}
        </p>
      ) : null}
      <ol className="suite-scene-grid">
        {briefs.map((brief) => (
          <li key={brief.scene_master_id}>
            <article
              className="rounded-lg border border-border bg-card/40 px-4 py-4 space-y-3"
              data-production-scene={brief.scene_master_id}
              data-production-status={brief.status}
              data-production-execution={brief.execution}
              data-production-approval={brief.approval ?? "none"}
              data-production-projects={brief.projects ? "attached" : "detached"}
            >
              <p className="suite-kicker">Production plan</p>
              <h3 className="text-base font-medium text-foreground">
                {sceneShortTitle(brief.title) ?? brief.title ?? "Untitled Scene"}
              </h3>
              <p className="font-mono text-xs text-muted-foreground">{brief.window_label}</p>
              <p className="suite-proposal-badge">
                {brief.status === "planning" ? "Planning" : brief.status.replace("_", " ")}
              </p>
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
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Execution</dt>
                  <dd className="text-muted-foreground">
                    No creative production executor is connected. Mux remains the video infrastructure and will ingest a result when an executor returns one.
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Realization</dt>
                  <dd className="text-muted-foreground">
                    {brief.result
                      ? `Mux production result · ${brief.result.approval}${brief.projects ? " · attached to 2.5D" : ""}`
                      : "No production realization yet. External AI/MCP execution is not connected."}
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
              {brief.result?.still_url ? (
                <div className="w-36">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brief.result.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                  <p className="mt-1 text-[10px] text-muted-foreground">Production result · Mux</p>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busyScene === brief.scene_master_id}
                onClick={() => execute(brief.scene_master_id)}
              >
                {busyScene === brief.scene_master_id ? "Checking executor…" : "Execute production"}
              </Button>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

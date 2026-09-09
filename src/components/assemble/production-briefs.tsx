"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { Button } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import { PRODUCTION_PROOF_SCENE_MASTER_ID } from "@/lib/production/adapter";
import type { SceneProductionBrief } from "@/lib/production/plan";

export function ProductionBriefs({
  universeId,
  briefs,
  proofExecutorAvailable = false,
}: {
  universeId: string;
  briefs: SceneProductionBrief[];
  proofExecutorAvailable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function post(path: string, body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey);
    setNote(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Production request failed.");
      }
      setNote(
        typeof payload.error === "string"
          ? payload.error
          : payload.already
            ? "That Powerhouse production realization already exists."
            : payload.attached
              ? "Approved production layer attached to 2.5D. Canonical Mux source is unchanged."
              : payload.approval === "approved"
                ? "Production realization approved. It is not public until attached."
                : payload.realization_id
                  ? "Mux ingested the production result. Awaiting Authority approval."
                  : "Request completed.",
      );
      router.refresh();
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "Production request failed.");
    } finally {
      setBusy(null);
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
        {briefs.map((brief) => {
          const isPowerhouse = brief.scene_master_id === PRODUCTION_PROOF_SCENE_MASTER_ID;
          return (
            <li key={brief.scene_master_id}>
              <article
                className="rounded-lg border border-border bg-card/40 px-4 py-4 space-y-3"
                data-production-scene={brief.scene_master_id}
                data-production-plan={brief.plan_id}
                data-production-status={brief.status}
                data-production-execution={brief.execution}
                data-production-approval={brief.approval ?? "none"}
                data-production-projects={brief.projects ? "attached" : "detached"}
                data-production-realization={brief.realization?.realization_id ?? "none"}
              >
                <p className="suite-kicker">Production plan</p>
                <h3 className="text-base font-medium text-foreground">
                  <Link href={`/authority/universes/${universeId}/scenes/${brief.scene_master_id}`} className="hover:underline">
                    {sceneShortTitle(brief.title) ?? brief.title ?? "Untitled Scene"}
                  </Link>
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
                      {brief.execution === "completed"
                        ? `${brief.result?.executor ?? "executor"} completed. Mux ingested the result.`
                        : "No creative production executor is connected. Mux remains the video infrastructure and will ingest a result when an executor returns one."}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Realization</dt>
                    <dd className="text-muted-foreground">
                      {brief.realization
                        ? `${brief.result?.approval ?? "awaiting"}${brief.projects ? " · attached to 2.5D" : ""}`
                        : "No production realization yet. External AI/MCP execution is not connected."}
                    </dd>
                  </div>
                  {brief.result ? (
                    <div>
                      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Production result</dt>
                      <dd className="text-muted-foreground">
                        {brief.projects ? "Playable on 2.5D" : "Mux ingested the result."}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <details className="suite-identifiers">
                  <summary>Technical details</summary>
                  <dl>
                    <div>
                      <dt>Plan</dt>
                      <dd className="font-mono break-all">{brief.plan_id}</dd>
                    </div>
                    {brief.realization ? (
                      <div>
                        <dt>Realization</dt>
                        <dd className="font-mono break-all">{brief.realization.realization_id}</dd>
                      </div>
                    ) : null}
                    {brief.result ? (
                      <div>
                        <dt>Mux playback</dt>
                        <dd className="font-mono break-all">{brief.result.playback_id}</dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      post("/api/authority/production/execute", {
                        universe_id: universeId,
                        scene_master_id: brief.scene_master_id,
                      }, `execute:${brief.scene_master_id}`)
                    }
                  >
                    {busy === `execute:${brief.scene_master_id}` ? "Checking executor…" : "Execute production"}
                  </Button>
                  {proofExecutorAvailable && isPowerhouse && !brief.result ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        post("/api/authority/production/execute", {
                          universe_id: universeId,
                          scene_master_id: brief.scene_master_id,
                          proof: true,
                        }, `proof:${brief.scene_master_id}`)
                      }
                    >
                      {busy === `proof:${brief.scene_master_id}` ? "Running proof…" : "Run Powerhouse proof"}
                    </Button>
                  ) : null}
                  {brief.result && brief.result.approval === "awaiting" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        post("/api/authority/production/approve", {
                          asset_id: brief.result!.asset_id,
                          approval: "approved",
                          attach: false,
                        }, `approve:${brief.scene_master_id}`)
                      }
                    >
                      {busy === `approve:${brief.scene_master_id}` ? "Approving…" : "Approve realization"}
                    </Button>
                  ) : null}
                  {brief.result && brief.result.approval === "approved" && !brief.projects ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        post("/api/authority/production/approve", {
                          asset_id: brief.result!.asset_id,
                          approval: "approved",
                          attach: true,
                        }, `attach:${brief.scene_master_id}`)
                      }
                    >
                      {busy === `attach:${brief.scene_master_id}` ? "Attaching…" : "Attach to 2.5D"}
                    </Button>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatTimelineMs } from "@/lib/media/timing";
import { PRODUCTION_PROOF_SCENE_MASTER_ID } from "@/lib/production/adapter";
import type { SceneProductionBrief } from "@/lib/production/plan";
import { PaginatedItems } from "./collection-pager";

function statusLabel(brief: SceneProductionBrief) {
  if (brief.status === "planning") return "Planning";
  return brief.status.replace("_", " ");
}

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
      <PaginatedItems items={briefs} label="Production plans">
        {(page) => (
          <ol className="grid gap-4 lg:grid-cols-2">
            {page.map((brief) => {
              const isPowerhouse = brief.scene_master_id === PRODUCTION_PROOF_SCENE_MASTER_ID;
              return (
                <li key={brief.scene_master_id}>
                  <Card
                    className="h-full bg-card/80"
                    data-production-scene={brief.scene_master_id}
                    data-production-plan={brief.plan_id}
                    data-production-status={brief.status}
                    data-production-execution={brief.execution}
                    data-production-approval={brief.approval ?? "none"}
                    data-production-projects={brief.projects ? "attached" : "detached"}
                    data-production-realization={brief.realization?.realization_id ?? "none"}
                  >
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Production plan
                        </p>
                        <Badge variant="secondary">{statusLabel(brief)}</Badge>
                      </div>
                      <CardTitle>
                        <Link href={`/authority/universes/${universeId}/scenes/${brief.scene_master_id}`} className="hover:underline">
                          {sceneShortTitle(brief.title) ?? brief.title ?? "Untitled Scene"}
                        </Link>
                      </CardTitle>
                      <CardDescription className="font-mono">{brief.window_label}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Creative Moments</dt>
                          <dd className="mt-1 text-sm text-foreground">
                            {brief.moments.length
                              ? brief.moments.map((moment) => moment.title ?? "Untitled").join(" · ")
                              : "None related"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Storyboard</dt>
                          <dd className="mt-1 text-sm text-foreground">
                            {brief.storyboard_count > 0
                              ? `${brief.storyboard_count} derived panel${brief.storyboard_count === 1 ? "" : "s"}`
                              : "No derived panels yet"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Visual</dt>
                          <dd className="mt-1 text-sm text-foreground">{brief.visual_intention}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Motion</dt>
                          <dd className="mt-1 text-sm text-foreground">
                            {brief.motion} · {brief.transition}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Output</dt>
                          <dd className="mt-1 text-sm text-foreground">{brief.output_target}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Execution</dt>
                          <dd className="mt-1 text-sm text-foreground">
                            {brief.execution === "completed"
                              ? `${brief.result?.executor ?? "executor"} completed`
                              : "Executor not connected"}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Realization</dt>
                          <dd className="mt-1 text-sm text-foreground">
                            {brief.realization
                              ? `${brief.result?.approval ?? "awaiting"}${brief.projects ? " · attached to 2.5D" : ""}`
                              : "No production realization yet"}
                          </dd>
                        </div>
                      </dl>
                      {brief.references.length > 0 ? (
                        <>
                          <Separator />
                          <ul className="flex flex-wrap gap-2">
                            {brief.references.map((reference) => (
                              <li key={reference.asset_id} className="w-28">
                                {reference.still_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={reference.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                                ) : (
                                  <div className="aspect-video rounded bg-muted/40" />
                                )}
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {reference.role} · {formatTimelineMs(reference.time_ms)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {brief.result?.still_url ? (
                        <div className="w-36">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={brief.result.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                          <p className="mt-1 text-[10px] text-muted-foreground">Production result · Mux</p>
                        </div>
                      ) : null}
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
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
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
                    </CardFooter>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </PaginatedItems>
    </div>
  );
}

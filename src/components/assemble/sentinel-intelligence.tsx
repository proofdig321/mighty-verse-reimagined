"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import { decideAuthoriseWindows } from "@/lib/media/sentinel-intelligence";
import { HolographicStage } from "@/components/experience/holographic-stage";
import { cn } from "@/lib/utils";

export function SentinelIntelligencePanel({
  universeId,
  universeTitle,
  intelligence,
  canAuthorise,
  inspectHref,
  holographicHref,
}: {
  universeId: string;
  universeTitle: string;
  intelligence: SentinelIntelligence;
  canAuthorise: boolean;
  inspectHref?: string | null;
  holographicHref?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    intelligence.proposals.filter((proposal) => proposal.status === "adjust").map((proposal) => proposal.scene_master_id),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decision = useMemo(
    () =>
      decideAuthoriseWindows({
        universe_id: universeId,
        proposals: intelligence.proposals,
        scene_master_ids: selected,
      }),
    [universeId, intelligence.proposals, selected],
  );

  async function authorise() {
    if (!decision.ok) {
      setError(decision.message);
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/authority/sentinel/authorise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe_id: universeId,
          scene_master_ids: selected,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Sentinel windows could not be authorised.");
      }
      setStatus(`Authorised ${payload.authorised} Scene window${payload.authorised === 1 ? "" : "s"} from Sentinel.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sentinel windows could not be authorised.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <div className="suite-intelligence">
      <div className="flex flex-wrap gap-2 mb-4">
        {inspectHref ? (
          <Link href={inspectHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open Inspect
          </Link>
        ) : null}
        {holographicHref ? (
          <Link href={holographicHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Enter 2.5D
          </Link>
        ) : null}
      </div>

      <div className="suite-intelligence-grid">
        <section aria-labelledby="sentinel-storyboard" className="suite-intelligence-block">
          <h3 id="sentinel-storyboard" className="suite-relation-kicker">
            Storyboard
          </h3>
          <p className="suite-section-note">
            Generated from Sentinel observations against Super Hero Ego Scenes. Beats are evidence, not new Scenes.
          </p>
          <ol className="sentinel-storyboard">
            {intelligence.storyboard.map((panel) => (
              <li key={panel.panel_id} className={panel.kind === "scene" ? "sentinel-panel-scene" : "sentinel-panel-beat"} data-panel-kind={panel.kind} data-scene-id={panel.scene_master_id ?? undefined}>
                {panel.still_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={panel.still_url} alt="" />
                ) : (
                  <div className="sentinel-panel-empty" />
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {panel.kind}
                </p>
                <p className="text-xs text-foreground">{panel.title}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{formatTimelineMs(panel.time_ms)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="sentinel-animation" className="suite-intelligence-block">
          <h3 id="sentinel-animation" className="suite-relation-kicker">
            Animation plan
          </h3>
          <p className="suite-section-note">
            Enter, hold, and exit language from change intensity. Planning only — no render is generated.
          </p>
          <ol className="space-y-2">
            {intelligence.animation.map((beat) => (
              <li key={beat.scene_master_id} className="rounded-md border border-border px-3 py-2" data-animation-scene={beat.scene_master_id}>
                <p className="text-sm text-foreground">{beat.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimelineMs(beat.start_ms)} → {formatTimelineMs(beat.end_ms)} · {beat.enter} in / {beat.exit} out · {beat.motion} · intensity {beat.intensity.toFixed(2)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="sentinel-holographic" className="suite-intelligence-block mt-6">
        <h3 id="sentinel-holographic" className="suite-relation-kicker">
          2.5D holographic
        </h3>
        <p className="suite-section-note">
          Creative Moments become spatial objects in front of their Scenes. The Mural remains the back plane. This is presentation, not canonical geometry.
        </p>
        <HolographicStage title={universeTitle} layers={intelligence.holographic} compact />
      </section>

      <section aria-labelledby="sentinel-proposals" className="suite-intelligence-block mt-6">
        <h3 id="sentinel-proposals" className="suite-relation-kicker">
          Scene-boundary proposals
        </h3>
        <p className="suite-section-note">
          Sentinel remembers what it observed. Authorising writes existing Scene windows only. Super Hero Ego keeps four Scenes.
        </p>
        <ul className="space-y-2">
          {intelligence.proposals.map((proposal) => (
            <li key={proposal.scene_master_id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2" data-proposal-scene={proposal.scene_master_id} data-proposal-status={proposal.status}>
              <div>
                <p className="text-sm text-foreground">{proposal.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatTimelineMs(proposal.canonical_start_ms)} → {formatTimelineMs(proposal.canonical_end_ms)}
                  {proposal.status === "adjust" ? (
                    <>
                      {" "}
                      · proposed {formatTimelineMs(proposal.proposed_start_ms)} → {formatTimelineMs(proposal.proposed_end_ms)}
                    </>
                  ) : (
                    " · aligned"
                  )}
                </p>
              </div>
              {proposal.status === "adjust" && canAuthorise ? (
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={selected.includes(proposal.scene_master_id)}
                    onChange={() => toggle(proposal.scene_master_id)}
                  />
                  Include
                </label>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {proposal.status}
                </span>
              )}
            </li>
          ))}
        </ul>
        {intelligence.unaligned_beats.length > 0 ? (
          <p className="suite-section-note mt-2">
            {intelligence.unaligned_beats.length} unaligned beat{intelligence.unaligned_beats.length === 1 ? "" : "s"} stay on the storyboard and are not turned into Scenes.
          </p>
        ) : null}
        {canAuthorise ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={busy || !decision.ok}
              onClick={() => void authorise()}
            >
              {busy ? "Authorising…" : "Authorise Sentinel windows"}
            </Button>
            {status ? (
              <p role="status" className="text-sm text-foreground">
                {status}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

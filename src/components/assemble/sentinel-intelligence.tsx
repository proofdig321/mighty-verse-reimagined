"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import { decideAuthoriseWindows } from "@/lib/media/sentinel-intelligence";
import { cn } from "@/lib/utils";

export function SentinelIntelligencePanel({
  universeId,
  intelligence,
  canAuthorise,
  inspectHref,
  previewHref,
}: {
  universeId: string;
  intelligence: SentinelIntelligence;
  canAuthorise: boolean;
  inspectHref?: string | null;
  previewHref?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    intelligence.proposals.filter((proposal) => proposal.status === "adjust").map((proposal) => proposal.scene_master_id),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openBeat, setOpenBeat] = useState<string | null>(null);

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

  const adjustCount = intelligence.proposals.filter((proposal) => proposal.status === "adjust").length;

  return (
    <div className="suite-intelligence">
      <section aria-labelledby="sentinel-evidence" className="suite-intelligence-block">
        <h3 id="sentinel-evidence" className="suite-relation-kicker">
          Evidence
        </h3>
        <p className="suite-section-note">
          Sentinel observed this media. Observation is not canonical authority.
          Derived intelligence follows as storyboard and animation plan until a curator authorises meaning.
        </p>
        <dl className="suite-evidence-facts">
          <div>
            <dt>Observations</dt>
            <dd>{intelligence.observation_count}</dd>
          </div>
          <div>
            <dt>Boundary candidates</dt>
            <dd>{intelligence.candidate_count}</dd>
          </div>
          <div>
            <dt>Unaligned beats</dt>
            <dd>{intelligence.unaligned_beats.length}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 mt-3">
          {inspectHref ? (
            <Link href={inspectHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Open Inspect
            </Link>
          ) : null}
          {previewHref ? (
            <Link href={previewHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Open 2.5D Studio Preview
            </Link>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="sentinel-storyboard" className="suite-intelligence-block mt-8">
        <h3 id="sentinel-storyboard" className="suite-section-title">
          Storyboard
        </h3>
        <p className="suite-section-note">
          Sequence through time. A canonical Scene is authorised meaning. A storyboard beat is Sentinel evidence and is not a Scene.
        </p>
        <ol className="sentinel-storyboard">
          {intelligence.storyboard.map((panel) => (
            <li
              key={panel.panel_id}
              className={panel.kind === "scene" ? "sentinel-panel-scene" : "sentinel-panel-beat"}
              data-panel-kind={panel.kind}
              data-scene-id={panel.scene_master_id ?? undefined}
            >
              <button type="button" className="sentinel-panel-open" onClick={() => setOpenBeat(openBeat === panel.panel_id ? null : panel.panel_id)}>
                {panel.still_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={panel.still_url} alt="" />
                ) : (
                  <div className="sentinel-panel-empty" />
                )}
                <p className={panel.kind === "scene" ? "suite-canon-badge" : "suite-proposal-badge"}>
                  {panel.kind === "scene" ? "Canonical Scene" : "Storyboard beat"}
                </p>
                <p className="text-sm text-foreground">{panel.title}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{formatTimelineMs(panel.time_ms)}</p>
              </button>
              {openBeat === panel.panel_id ? (
                <p className="suite-section-note mt-2">
                  {panel.kind === "scene"
                    ? "This panel is an existing authorised Scene. Sentinel did not create it."
                    : `This beat exists because Sentinel observed a change${panel.change_score != null ? ` (score ${panel.change_score.toFixed(2)})` : ""}. It is not a canonical Scene.`}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sentinel-animation" className="suite-intelligence-block mt-8">
        <h3 id="sentinel-animation" className="suite-section-title">
          Animation plan
        </h3>
        <p className="suite-section-note">
          Derived planning language from change intensity. This is not a render and not canonical geometry until a later realisation.
        </p>
        <ol className="suite-animation-plan">
          {intelligence.animation.map((beat, index) => (
            <li key={beat.scene_master_id} data-animation-scene={beat.scene_master_id}>
              <p className="suite-kicker">Beat {String(index + 1).padStart(2, "0")}</p>
              <p className="text-sm text-foreground">{beat.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatTimelineMs(beat.start_ms)} → {formatTimelineMs(beat.end_ms)} · {beat.enter} in / {beat.exit} out · {beat.motion}
              </p>
              <p className="suite-proposal-badge mt-2">Planning</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sentinel-proposals" className="suite-intelligence-block mt-8">
        <h3 id="sentinel-proposals" className="suite-section-title">
          Scene-boundary proposals
        </h3>
        <p className="suite-section-note">
          System proposal is Sentinel-derived. Canonical is already authorised. Authorising writes existing Scene windows only. It does not create Scenes.
        </p>
        <ul className="space-y-2">
          {intelligence.proposals.map((proposal) => (
            <li
              key={proposal.scene_master_id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
              data-proposal-scene={proposal.scene_master_id}
              data-proposal-status={proposal.status}
            >
              <div>
                <p className={proposal.status === "adjust" ? "suite-proposal-badge" : "suite-canon-badge"}>
                  {proposal.status === "adjust" ? "System proposal" : "Canonical"}
                </p>
                <p className="text-sm text-foreground mt-1">{proposal.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Canonical {formatTimelineMs(proposal.canonical_start_ms)} → {formatTimelineMs(proposal.canonical_end_ms)}
                  {proposal.status === "adjust" ? (
                    <>
                      {" "}
                      · proposed {formatTimelineMs(proposal.proposed_start_ms)} → {formatTimelineMs(proposal.proposed_end_ms)}
                    </>
                  ) : null}
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
              ) : null}
            </li>
          ))}
        </ul>
        {intelligence.unaligned_beats.length > 0 ? (
          <p className="suite-section-note mt-2">
            {intelligence.unaligned_beats.length} unaligned beat{intelligence.unaligned_beats.length === 1 ? "" : "s"} stay on the storyboard and are not turned into Scenes.
          </p>
        ) : null}
        <div id="sentinel-authorise" className="mt-4">
          {canAuthorise ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={busy || !decision.ok}
                onClick={() => void authorise()}
              >
                {busy ? "Authorising…" : "Authorise Sentinel windows"}
              </Button>
              <p className="suite-section-note">
                {adjustCount > 0
                  ? `${adjustCount} window${adjustCount === 1 ? "" : "s"} need curator authorisation.`
                  : "Canonical windows already match Sentinel."}
              </p>
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
        </div>
      </section>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { formatShotWindow, cameraEvidenceStatus, evidenceStatusLabel, temporalEvidenceStatus, visualEvidenceStatus, type CinematicAnalysis, type CinematicShot } from "@/lib/media/cinematic-evidence";
import { formatTimelineMs } from "@/lib/media/timing";
import type { StoryboardSourceRecord } from "@/lib/storyboard/source";

export function SentinelSummary({
  observationCount,
  referenceCount,
  mediaFactCount,
  onView,
  href,
}: {
  observationCount: number;
  referenceCount: number;
  mediaFactCount: number;
  onView?: () => void;
  href?: string;
}) {
  return (
    <section className="sentinel-summary" aria-label="Sentinel">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sentinel</p>
      <p className="text-sm text-foreground">
        {observationCount} observation{observationCount === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-muted-foreground">
        {referenceCount} reference{referenceCount === 1 ? "" : "s"} · {mediaFactCount} verified media fact{mediaFactCount === 1 ? "" : "s"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Observations and evidence. Sentinel does not authorise creative meaning.
      </p>
      {href ? (
        <Link href={href} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
          View Evidence
        </Link>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={onView}>
          View Evidence
        </Button>
      )}
    </section>
  );
}

export function SentinelWorkspace({
  source,
  analysis,
  selectedShotId,
  selectedCountLabel,
  analysing,
  message,
  error,
  onAnalyse,
  onSelectShot,
  onToggleShot,
  selectedIds,
  onSelectAll,
  onClearSelection,
  onAddReferences,
  onAddToStoryboard,
  onUseSelected,
  onAssociatePanel,
  associateEnabled,
}: {
  source: StoryboardSourceRecord | null;
  analysis: CinematicAnalysis | null;
  selectedShotId: string | null;
  selectedCountLabel?: string;
  analysing?: boolean;
  message?: string | null;
  error?: string | null;
  onAnalyse: () => void;
  onSelectShot: (shot: CinematicShot) => void;
  onToggleShot: (shotId: string) => void;
  selectedIds: string[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAddReferences: () => void;
  onAddToStoryboard: () => void;
  onUseSelected?: () => void;
  onAssociatePanel?: () => void;
  associateEnabled?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(selectedShotId);
  const shots = analysis?.shots ?? [];
  const selected = shots.find((shot) => shot.shot_id === (selectedShotId ?? openId)) ?? shots[0] ?? null;
  const checked = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div className="space-y-6" data-sentinel-workspace="true">
      <section className="space-y-3" aria-labelledby="sentinel-source">
        <h3 id="sentinel-source" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Source
        </h3>
        {source?.endpoint_ref || source?.playback_id ? (
          <StoryboardHlsPreview
            endpoint={source.endpoint_ref ?? `https://stream.mux.com/${source.playback_id}.m3u8`}
            poster={source.still_url}
            label={source.title}
          />
        ) : (
          <p className="suite-empty">Attach source media on References first. Sentinel analyses the Storyboard source, not Super Hero Ego canonical media.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {source ? `${source.title} · observational only · creates_scene = false` : "No source attached."}
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="sentinel-analysis">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="sentinel-analysis" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Analysis
          </h3>
          <Button type="button" size="sm" onClick={onAnalyse} disabled={!source?.playback_id || analysing}>
            {analysing ? "Analysing…" : "Analyse source"}
          </Button>
        </div>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        {analysis ? (
          <>
            <p className="text-sm text-foreground">{analysis.overview}</p>
            <p className="text-xs text-muted-foreground">
              Mode: {analysis.analysis_mode === "gemini-sampled-frames" ? "Gemini sampled frames" : "Sampled-frame fallback"}
              {analysis.provider_limitation ? ` · ${analysis.provider_limitation}` : ""}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <caption className="sr-only">Storyline</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2"> </th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Shot</th>
                    <th className="px-2 py-2">What happens</th>
                    <th className="px-2 py-2">Camera</th>
                    <th className="px-2 py-2">Motion</th>
                  </tr>
                </thead>
                <tbody>
                  {shots.map((shot) => (
                    <tr
                      key={shot.shot_id}
                      className={shot.shot_id === selected?.shot_id ? "bg-muted/50" : undefined}
                      data-sentinel-shot={shot.shot_id}
                      data-selected={shot.shot_id === selectedShotId ? "true" : "false"}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${cinematicToTitle(shot)}`}
                          checked={checked.has(shot.shot_id)}
                          onChange={() => onToggleShot(shot.shot_id)}
                        />
                      </td>
                      <td className="px-2 py-2 font-mono">{formatShotWindow(shot)}</td>
                      <td className="px-2 py-2">
                        <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => {
                          setOpenId(shot.shot_id);
                          onSelectShot(shot);
                        }}>
                          {cinematicToTitle(shot)}
                          {shot.shot_id === selectedShotId ? " · Selected" : ""}
                        </button>
                      </td>
                      <td className="px-2 py-2">{shot.what_happens}</td>
                      <td className="px-2 py-2">{shot.camera === "unknown" ? "Unknown" : shot.camera}</td>
                      <td className="px-2 py-2">{shot.motion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="suite-empty">No cinematic analysis yet. Analyse the attached source to see timing, camera, subjects, and motion.</p>
        )}
      </section>

      {selected ? (
        <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby="sentinel-selected">
          <h3 id="sentinel-selected" className="text-sm font-medium text-foreground">
            {cinematicToTitle(selected)}
          </h3>
          <p className="font-mono text-xs text-muted-foreground">{formatShotWindow(selected)} · {formatTimelineMs(selected.duration_ms)} duration</p>
          {selected.still_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.still_url} alt="" className="aspect-video w-full max-w-lg rounded object-cover" />
          ) : null}
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="suite-kicker">What happens</dt>
              <dd>{selected.what_happens}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Camera · {evidenceStatusLabel(cameraEvidenceStatus(selected))}</dt>
              <dd>{selected.camera_explanation || selected.camera} · {selected.framing}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Subjects · {evidenceStatusLabel(visualEvidenceStatus(selected.subjects[0]?.description))}</dt>
              <dd>{selected.subjects.length ? selected.subjects.map((subject) => `${subject.description}${subject.position ? ` — ${subject.position}` : ""}`).join(" · ") : "None identified"}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Motion · {evidenceStatusLabel(temporalEvidenceStatus(selected.motion))}</dt>
              <dd>{selected.motion}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Environment · {evidenceStatusLabel(visualEvidenceStatus(selected.environment))}</dt>
              <dd>{selected.environment}{selected.lighting ? ` · ${selected.lighting}` : ""}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Transition</dt>
              <dd>{selected.transition}</dd>
            </div>
            <div>
              <dt className="suite-kicker">Confidence</dt>
              <dd className="capitalize">{selected.confidence} · {selected.analysis_mode === "gemini-sampled-frames" ? "Gemini sampled frames" : "Fallback"}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Sentinel observes. Edit the Storyboard panel to authorise a different camera, action, or meaning.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onUseSelected} disabled={!selected || !onUseSelected}>
              Use as Reference
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onSelectShot(selected)}>
              Select this shot
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="sentinel-actions">
        <h3 id="sentinel-actions" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Actions
        </h3>
        <p className="text-xs text-muted-foreground">{selectedCountLabel ?? `${selectedIds.length} observation${selectedIds.length === 1 ? "" : "s"} selected`}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={!shots.length}>Select all</Button>
          <Button type="button" size="sm" variant="outline" onClick={onClearSelection} disabled={!selectedIds.length}>Clear selection</Button>
          <Button type="button" size="sm" onClick={onAddReferences} disabled={!selectedIds.length}>
            Add {selectedIds.length || ""} to References
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAssociatePanel} disabled={!selectedIds.length || !associateEnabled}>
            Associate selected with current panel
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAddToStoryboard} disabled={!selectedIds.length}>
            Add selected observations to storyboard
          </Button>
        </div>
      </section>
    </div>
  );
}

function cinematicToTitle(shot: CinematicShot): string {
  return `Shot ${String(shot.sequence).padStart(2, "0")}`;
}

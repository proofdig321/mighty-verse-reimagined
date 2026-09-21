"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceBadge, ConfidenceBadge } from "./evidence-badge";
import { cn } from "@/lib/utils";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { formatShotWindow, cameraEvidenceStatus, evidenceStatusLabel, temporalEvidenceStatus, visualEvidenceStatus, type CinematicAnalysis, type CinematicShot } from "@/lib/media/cinematic-evidence";
import { formatTimelineMs } from "@/lib/media/timing";
import type { StoryboardSourceRecord } from "@/lib/storyboard/source";
import { PaginatedItems } from "./collection-pager";

export function SentinelSummary({
  observationCount,
  referenceCount,
  mediaFactCount,
  onView,
  href,
  showCta = true,
}: {
  observationCount: number;
  referenceCount: number;
  mediaFactCount: number;
  onView?: () => void;
  href?: string;
  showCta?: boolean;
}) {
  return (
    <section className="sentinel-summary" aria-label="Sentinel">
      <div className="sentinel-summary-stat">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observations</p>
        <p className="text-lg font-semibold text-foreground">{observationCount}</p>
      </div>
      <div className="sentinel-summary-stat">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">References</p>
        <p className="text-lg font-semibold text-foreground">{referenceCount}</p>
      </div>
      <div className="sentinel-summary-stat">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Media facts</p>
        <p className="text-lg font-semibold text-foreground">{mediaFactCount}</p>
      </div>
      {showCta && href ? (
        <Link href={href} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "sentinel-summary-cta")}>
          View Evidence
        </Link>
      ) : null}
      {showCta && !href && onView ? (
        <Button type="button" size="sm" variant="outline" className="sentinel-summary-cta" onClick={onView}>
          View Evidence
        </Button>
      ) : null}
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
      <Card className="bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Source</CardTitle>
          <CardDescription>
            {source ? `${source.title} · observational only` : "This Universe has no mural media yet. Sentinel observes the mural, not Super Hero Ego by inference."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {source?.endpoint_ref || source?.playback_id ? (
            <StoryboardHlsPreview
              endpoint={source.endpoint_ref ?? `https://stream.mux.com/${source.playback_id}.m3u8`}
              poster={source.still_url}
              label={source.title}
            />
          ) : (
            <p className="suite-empty">No mural media is attached to this Universe.</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Analysis</CardTitle>
            {analysis ? (
              <CardDescription className="mt-1">
                {analysis.analysis_mode === "gemini-sampled-frames" ? "Gemini sampled frames" : "Sampled-frame fallback"}
                {analysis.provider_limitation ? ` · ${analysis.provider_limitation}` : ""}
              </CardDescription>
            ) : (
              <CardDescription className="mt-1">Analyse the attached source to see timing, camera, subjects, and motion.</CardDescription>
            )}
          </div>
          <Button type="button" size="sm" onClick={onAnalyse} disabled={!source?.playback_id || analysing}>
            {analysing ? "Analysing…" : "Analyse source"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          {analysis ? (
            <>
              <p className="text-sm text-foreground">{analysis.overview}</p>
              <PaginatedItems items={shots} pageSize={8} label="Sentinel observations">
                {(page) => (
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
                        {page.map((shot) => (
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
                )}
              </PaginatedItems>
            </>
          ) : (
            <p className="suite-empty">No cinematic analysis yet.</p>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card className="bg-card/80" aria-labelledby="sentinel-selected">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle id="sentinel-selected" className="text-base">{cinematicToTitle(selected)}</CardTitle>
                <CardDescription className="font-mono">
                  {formatShotWindow(selected)} · {formatTimelineMs(selected.duration_ms)}
                </CardDescription>
              </div>
              <ConfidenceBadge confidence={selected.confidence} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.still_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.still_url} alt="" className="aspect-video w-full max-w-lg rounded-lg object-cover" />
            ) : null}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">What happens</dt>
                <dd className="mt-1 text-sm">{selected.what_happens}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">Camera <EvidenceBadge status={cameraEvidenceStatus(selected)} /></dt>
                <dd className="mt-1 text-sm">{selected.camera_explanation || selected.camera} · {selected.framing}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">Motion <EvidenceBadge status={temporalEvidenceStatus(selected.motion)} /></dt>
                <dd className="mt-1 text-sm">{selected.motion}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">Subjects <EvidenceBadge status={visualEvidenceStatus(selected.subjects[0]?.description)} /></dt>
                <dd className="mt-1 text-sm">{selected.subjects.length ? selected.subjects.map((subject) => `${subject.description}${subject.position ? ` — ${subject.position}` : ""}`).join(" · ") : "None identified"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">Environment <EvidenceBadge status={visualEvidenceStatus(selected.environment)} /></dt>
                <dd className="mt-1 text-sm">{selected.environment}{selected.lighting ? ` · ${selected.lighting}` : ""}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Transition</dt>
                <dd className="mt-1 text-sm">{selected.transition}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={onUseSelected} disabled={!selected || !onUseSelected}>
                Use as Reference
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onSelectShot(selected)}>
                Select this shot
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-card/80" aria-labelledby="sentinel-actions">
        <CardHeader>
          <CardTitle id="sentinel-actions" className="text-base">Actions</CardTitle>
          <CardDescription>{selectedCountLabel ?? `${selectedIds.length} observation${selectedIds.length === 1 ? "" : "s"} selected`}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

function cinematicToTitle(shot: CinematicShot): string {
  return `Shot ${String(shot.sequence).padStart(2, "0")}`;
}

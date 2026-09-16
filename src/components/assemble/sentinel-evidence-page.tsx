"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import type { CinematicAnalysis, CinematicShot } from "@/lib/media/cinematic-evidence";
import type { StoryboardWorkRecord } from "@/lib/storyboard/document";
import { creativeSuiteStoryboardHref } from "@/lib/assemble/studio";
import { cn } from "@/lib/utils";
import { SentinelIntelligencePanel } from "./sentinel-intelligence";
import { SentinelSummary, SentinelWorkspace } from "./sentinel-workspace";

export function SentinelEvidencePage({
  universeId,
  universeTitle,
  intelligence,
  canAuthoriseSentinel,
  inspectHref,
  previewHref,
  establishHref,
}: {
  universeId: string;
  universeTitle: string;
  intelligence: SentinelIntelligence | null;
  canAuthoriseSentinel: boolean;
  inspectHref?: string | null;
  previewHref: string;
  establishHref?: string | null;
}) {
  const [work, setWork] = useState<StoryboardWorkRecord | null>(null);
  const [cinematic, setCinematic] = useState<CinematicAnalysis | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/authority/storyboard?universe_id=${encodeURIComponent(universeId)}`);
      const payload = await response.json().catch(() => ({}));
      if (payload.work) setWork(payload.work);
      if (payload.cinematic) setCinematic(payload.cinematic);
      if (typeof payload.selected_shot_id === "string") setSelectedShotId(payload.selected_shot_id);
    })();
  }, [universeId]);

  const source = work?.sources?.[0] ?? null;
  const selectedShots = useMemo(
    () => (cinematic?.shots ?? []).filter((shot) => selectedIds.includes(shot.shot_id)),
    [cinematic, selectedIds],
  );
  const shots = cinematic?.shots ?? [];

  async function post(action: string, extra: Record<string, unknown> = {}) {
    if (!work) {
      setError("Create or open a Storyboard work before Sentinel can bind evidence.");
      return null;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        work_id: work.work_id,
        action,
        ...extra,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Sentinel could not complete that action.");
      return payload;
    }
    if (payload.work) setWork(payload.work);
    if (payload.cinematic) setCinematic(payload.cinematic);
    if (typeof payload.selected_shot_id === "string") setSelectedShotId(payload.selected_shot_id);
    return payload;
  }

  async function analyse() {
    setAnalysing(true);
    setError(null);
    const payload = await post("analyse-sentinel");
    setAnalysing(false);
    if (payload?.cinematic) {
      setMessage(
        payload.provider === "gemini"
          ? "Gemini described sampled Mux frames across the source. This is observational, not a transformation."
          : "Sampled-frame fallback. Full video-file understanding was not used.",
      );
    }
  }

  async function selectShot(shot: CinematicShot) {
    setSelectedShotId(shot.shot_id);
    const payload = await post("select-sentinel-shot", { shot });
    if (payload?.selected_shot_id) setSelectedShotId(payload.selected_shot_id);
    if (payload?.selected_panel_id) {
      setMessage(`Selected ${shotTitle(shot)} · Storyboard panel is active.`);
    }
  }

  async function addReferences(items: CinematicShot[], panelId?: string | null) {
    const payload = await post("add-sentinel-references", {
      shots: items,
      playback_id: source?.playback_id,
      panel_id: panelId ?? work?.selection?.panel_id ?? null,
    });
    if (payload) {
      setMessage(`Added ${payload.added ?? 0} to References${payload.skipped ? ` · skipped ${payload.skipped} duplicate${payload.skipped === 1 ? "" : "s"}` : ""}.`);
    }
  }

  const selectedCount = selectedIds.length;
  const storyboardHref = creativeSuiteStoryboardHref(universeId, null, "references");

  return (
    <div className="space-y-8" data-sentinel-page="true">
      <SentinelSummary
        observationCount={cinematic?.shots.length ?? intelligence?.storyboard.length ?? 0}
        referenceCount={work?.frames?.length ?? 0}
        mediaFactCount={source?.playback_id ? 1 : 0}
        href={storyboardHref}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sentinel</p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Observational evidence for {universeTitle}. Sentinel describes what is happening in the attached Storyboard source.
            It does not create Scenes, mutate Super Hero Ego, or author transformations.
          </p>
        </div>
        <Link href={storyboardHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
          Open Storyboard References
        </Link>
      </div>

      <SentinelWorkspace
        source={source}
        analysis={cinematic}
        selectedShotId={selectedShotId}
        selectedIds={selectedIds}
        selectedCountLabel={`${selectedCount} observation${selectedCount === 1 ? "" : "s"} selected`}
        analysing={analysing || busy}
        message={message}
        error={error}
        onAnalyse={() => void analyse()}
        onSelectShot={(shot) => void selectShot(shot)}
        onToggleShot={(shotId) => {
          setSelectedIds((current) => current.includes(shotId) ? current.filter((id) => id !== shotId) : [...current, shotId]);
        }}
        onSelectAll={() => setSelectedIds(shots.map((shot) => shot.shot_id))}
        onClearSelection={() => setSelectedIds([])}
        onAddReferences={() => void addReferences(selectedShots)}
        onAddToStoryboard={() => void post("add-sentinel-shots", { shots: selectedShots }).then((payload) => {
          if (payload?.panel_ids) setMessage(`Added ${payload.panel_ids.length} observation${payload.panel_ids.length === 1 ? "" : "s"} to the storyboard.`);
        })}
        onUseSelected={() => {
          const shot = shots.find((item) => item.shot_id === selectedShotId) ?? shots[0];
          if (shot) void addReferences([shot]);
        }}
        onAssociatePanel={() => void addReferences(selectedShots, work?.selection?.panel_id ?? null)}
        associateEnabled={Boolean(work?.selection?.panel_id || work?.panels[0]?.panel_id)}
      />

      {intelligence ? (
        <section className="space-y-3" aria-labelledby="universe-sentinel">
          <h2 id="universe-sentinel" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Universe evidence
          </h2>
          <p className="text-xs text-muted-foreground">
            Canonical Universe inspection remains separate. Authorising windows never creates Scenes and does not attach Judas to Super Hero Ego.
          </p>
          <SentinelIntelligencePanel
            universeId={universeId}
            intelligence={intelligence}
            canAuthorise={canAuthoriseSentinel}
            canRetainReference={canAuthoriseSentinel}
            inspectHref={inspectHref}
            previewHref={previewHref}
            establishHref={establishHref}
          />
        </section>
      ) : null}
    </div>
  );
}

function shotTitle(shot: CinematicShot): string {
  return `Shot ${String(shot.sequence).padStart(2, "0")}`;
}

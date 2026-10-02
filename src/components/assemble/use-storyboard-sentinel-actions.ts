"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { CinematicAnalysis, CinematicShot } from "@/lib/media/cinematic-evidence";
import type { StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";

export type StoryboardMaterialTab = "script" | "assist" | "sentinel" | "references" | "panels" | "stills" | "motion" | "assembly";

type SentinelMutationResult = {
  work?: StoryboardWorkRecord;
  cinematic?: CinematicAnalysis;
  provider?: string;
  error?: string;
  selected_panel_id?: string;
  selected_shot_id?: string;
  added?: number;
  skipped?: number;
  panel_ids?: string[];
};

export function useStoryboardSentinelActions({
  universeId,
  work,
  sentinelPanels,
  selectedPersisted,
  cinematic,
  cinematicShotId,
  setCinematic,
  setCinematicShotId,
  mutate,
  applyWork,
  setSelectedId,
  setDraftPanel,
  setFirstFrame,
  setTab,
}: {
  universeId: string | null;
  work: StoryboardWorkRecord | null;
  sentinelPanels: StoryboardPanel[];
  selectedPersisted: StoryboardPanelRecord | null;
  cinematic: CinematicAnalysis | null;
  cinematicShotId: string | null;
  setCinematic: Dispatch<SetStateAction<CinematicAnalysis | null>>;
  setCinematicShotId: Dispatch<SetStateAction<string | null>>;
  mutate: (label: string, action: string, payload: Record<string, unknown>, kind?: "authoring" | "selection") => Promise<SentinelMutationResult | undefined>;
  applyWork: (work: StoryboardWorkRecord, preferredPanelId?: string | null) => void;
  setSelectedId: (id: string | null) => void;
  setDraftPanel: (panel: Partial<StoryboardPanelRecord>) => void;
  setFirstFrame: (url: string) => void;
  setTab: (tab: StoryboardMaterialTab) => void;
}) {
  const [analysing, setAnalysing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importSentinel() {
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "import-sentinel",
        panels: sentinelPanels.map((panel) => ({
          title: panel.title,
          description: panel.kind === "scene" ? "Canonical Scene evidence. Not a new Scene." : panel.title,
          still_url: panel.still_url,
          time_ms: panel.time_ms,
          sentinel_panel_id: panel.panel_id,
          scene_master_id: panel.scene_master_id,
        })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.work) applyWork(payload.work);
    if (payload.work?.panels?.[0]) setTab("panels");
  }

  async function analyseSentinel() {
    if (!work) {
      setError("Save or create the storyboard before analysing source media.");
      return;
    }
    setAnalysing(true);
    setError(null);
    const result = await mutate("Analyse Sentinel", "analyse-sentinel", {});
    setAnalysing(false);
    if (result?.cinematic) {
      setCinematic(result.cinematic);
      setMessage(
        result.provider === "gemini"
          ? "Gemini described sampled Mux frames across the attached source. Sentinel remains observational."
          : "Sampled-frame fallback. Full video-file understanding was not used.",
      );
    } else if (result?.error) {
      setError(result.error);
    }
  }

  async function selectCinematicShot(shot: CinematicShot) {
    setCinematicShotId(shot.shot_id);
    const result = await mutate("Select Sentinel shot", "select-sentinel-shot", { shot }, "selection");
    if (typeof result?.selected_panel_id === "string") setSelectedId(result.selected_panel_id);
    if (typeof result?.selected_shot_id === "string") setCinematicShotId(result.selected_shot_id);
    if (result?.work) {
      const panel = result.work.panels.find((item) => item.panel_id === result.selected_panel_id);
      if (panel) {
        setDraftPanel(panel);
        setFirstFrame(panel.still_url ?? "");
      }
    }
    setMessage(`Selected Shot ${String(shot.sequence).padStart(2, "0")}. Storyboard panel and inspector now use this observation.`);
  }

  async function addCinematicReferences(shots: CinematicShot[], panelId?: string | null) {
    const playbackId = work?.sources?.[0]?.playback_id;
    if (!playbackId) {
      setError("Attach source media before creating references.");
      return;
    }
    const result = await mutate("Add Sentinel references", "add-sentinel-references", {
      shots,
      playback_id: playbackId,
      panel_id: panelId ?? selectedPersisted?.panel_id ?? null,
    }, "selection");
    if (result) {
      setMessage(`Added ${result.added ?? 0} to References${result.skipped ? ` · skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}.`);
      if ((result.added ?? 0) > 0) setTab("references");
    }
  }

  async function addCinematicShots(shots: CinematicShot[]) {
    const result = await mutate("Add Sentinel shots", "add-sentinel-shots", { shots }, "selection");
    if (Array.isArray(result?.panel_ids)) {
      setMessage(`Added ${result.panel_ids.length} observation${result.panel_ids.length === 1 ? "" : "s"} to the storyboard.`);
      const last = result.panel_ids[result.panel_ids.length - 1];
      if (typeof last === "string") setSelectedId(last);
    }
  }

  return {
    cinematic,
    cinematicShotId,
    analysing,
    message,
    setMessage,
    error,
    setError,
    importSentinel,
    analyseSentinel,
    selectCinematicShot,
    addCinematicReferences,
    addCinematicShots,
  };
}

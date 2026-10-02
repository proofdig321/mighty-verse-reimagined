"use client";

import type { Dispatch, SetStateAction } from "react";
import type { CinematicAnalysis } from "@/lib/media/cinematic-evidence";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import {
  historyStorageKey,
  parseHistory,
  pushHistory,
  serializeHistory,
  workToSnapshot,
  type AuthoringSnapshot,
  type HistoryState,
} from "@/lib/storyboard/history";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

type AssemblyItems = AuthoringSnapshot["assembly"];

export function useStoryboardPersistence({
  universeId,
  work,
  script,
  workTitle,
  assemblyItems,
  history,
  selectedId,
  selectedPersisted,
  draftPanel,
  backHref,
  setWork,
  setWorkTitle,
  setScript,
  setAssemblyItems,
  setHistory,
  setSelectedId,
  setScriptPanels,
  setDraftPanel,
  setFirstFrame,
  setPanelStills,
  setCinematic,
  setCinematicShotId,
  setDirty,
  setSaveFailed,
  setSaveState,
  setMediaState,
  setDeleteOpen,
  setDeleteBusy,
  setDeleteError,
  onSnapshot,
  onDeleted,
}: {
  universeId: string | null;
  work: StoryboardWorkRecord | null;
  script: string;
  workTitle: string;
  assemblyItems: AssemblyItems;
  history: HistoryState;
  selectedId: string | null;
  selectedPersisted: StoryboardPanelRecord | null;
  draftPanel: Partial<StoryboardPanelRecord>;
  backHref: string;
  setWork: Dispatch<SetStateAction<StoryboardWorkRecord | null>>;
  setWorkTitle: Dispatch<SetStateAction<string>>;
  setScript: Dispatch<SetStateAction<string>>;
  setAssemblyItems: Dispatch<SetStateAction<AssemblyItems>>;
  setHistory: Dispatch<SetStateAction<HistoryState>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setScriptPanels: Dispatch<SetStateAction<import("@/lib/storyboard/script").StoryboardScriptPanel[]>>;
  setDraftPanel: Dispatch<SetStateAction<Partial<StoryboardPanelRecord>>>;
  setFirstFrame: Dispatch<SetStateAction<string>>;
  setPanelStills: Dispatch<SetStateAction<Record<string, string>>>;
  setCinematic: Dispatch<SetStateAction<CinematicAnalysis | null>>;
  setCinematicShotId: Dispatch<SetStateAction<string | null>>;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setSaveFailed: Dispatch<SetStateAction<boolean>>;
  setSaveState: Dispatch<SetStateAction<GenerationState>>;
  setMediaState: Dispatch<SetStateAction<GenerationState>>;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteBusy: Dispatch<SetStateAction<boolean>>;
  setDeleteError: Dispatch<SetStateAction<string | null>>;
  onSnapshot: (snapshot: AuthoringSnapshot) => void;
  onDeleted: (backHref: string) => void;
}) {
  function snapshotOf(next: StoryboardWorkRecord, nextScript = script, nextAssembly = assemblyItems): AuthoringSnapshot {
    return workToSnapshot({
      title: next.title,
      body: next.body || nextScript,
      premise: next.premise,
      panels: next.panels.map((panel) => ({
        panel_id: panel.panel_id,
        sequence: panel.sequence,
        title: panel.title,
        description: panel.description,
        narrative_purpose: panel.narrative_purpose,
        action: panel.action,
        dialogue: panel.dialogue,
        narration: panel.narration,
        camera: panel.camera,
        camera_movement: panel.camera_movement,
        framing: panel.framing,
        lens_style: panel.lens_style,
        lighting: panel.lighting,
        environment: panel.environment,
        characters: panel.characters,
        mood: panel.mood,
        transition: panel.transition,
        duration_ms: panel.duration_ms,
        aspect_ratio: panel.aspect_ratio,
        status: panel.status,
        active_still_asset_id: panel.active_still_asset_id,
        active_motion_asset_id: panel.active_motion_asset_id,
        still_url: panel.still_url,
        motion_playback_id: panel.motion_playback_id,
        motion_endpoint: panel.motion_endpoint,
        references: panel.references,
        user_locked: panel.user_locked,
      })),
      assembly: next.assembly?.items ?? nextAssembly,
    });
  }

  function applyWork(next: StoryboardWorkRecord, preferredPanelId?: string | null) {
    setWork(next);
    setWorkTitle(next.title);
    if (next.body) setScript(next.body);
    if (next.assembly?.items) setAssemblyItems(next.assembly.items);
    if (next.cinematic) setCinematic(next.cinematic);
    onSnapshot(snapshotOf(next, next.body, next.assembly?.items ?? []));
    if (typeof window !== "undefined") {
      setHistory(parseHistory(window.localStorage.getItem(historyStorageKey(next.work_id))));
    }
    const preferred = preferredPanelId ?? next.selection?.panel_id ?? null;
    if (preferred) setSelectedId(preferred);
    if (next.selection?.shot_id) setCinematicShotId(next.selection.shot_id);
    if (next.panels.length) {
      setScriptPanels([]);
      setSelectedId((current) => preferred ?? current ?? next.panels[0]?.panel_id ?? null);
      const active = next.panels.find((panel) => panel.panel_id === (preferred ?? selectedId)) ?? next.panels[0];
      if (active) {
        setDraftPanel(active);
        setFirstFrame(active.still_url ?? "");
      }
      const stills: Record<string, string> = {};
      for (const panel of next.panels) {
        if (panel.still_url) stills[panel.panel_id] = panel.still_url;
      }
      setPanelStills((current) => ({ ...stills, ...current }));
    }
    setDirty(false);
    setSaveFailed(false);
  }

  async function mutate(
    label: string,
    action: string,
    payload: Record<string, unknown>,
    kind: "authoring" | "selection" = "authoring",
  ) {
    if (!work) return;
    const before = snapshotOf(work);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, work_id: work.work_id, action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (result.work) {
      const after = snapshotOf(result.work);
      const nextHistory = pushHistory(history, {
        id: `${Date.now()}`,
        label,
        kind,
        reversible: true,
        persistent: true,
        undoHint: `Undo ${label.toLowerCase()}`,
        before,
        after,
      });
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(result.work.work_id), serializeHistory(nextHistory));
      applyWork(result.work, typeof result.selected_panel_id === "string" ? result.selected_panel_id : null);
    }
    return result;
  }

  async function restoreFromSnapshot(snapshot: AuthoringSnapshot, nextHistory: HistoryState) {
    if (!work) return;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore-snapshot",
        work_id: work.work_id,
        title: snapshot.title,
        body: snapshot.body,
        premise: snapshot.premise,
        panels: snapshot.panels,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.work) {
      applyWork(payload.work);
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(payload.work.work_id), serializeHistory(nextHistory));
    }
  }

  async function saveBody(nextBody = script): Promise<StoryboardWorkRecord | null> {
    setSaveState({ status: "generating", message: "Saving…" });
    setSaveFailed(false);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, action: "save", body: nextBody, work_id: work?.work_id, title: workTitle }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveFailed(true);
      setSaveState({ status: "failed", message: payload.error ?? "Could not save the story body." });
      return null;
    }
    if (payload.work) applyWork(payload.work);
    setDirty(false);
    setSaveState({ status: "ready", message: "Story body saved as a creative artifact. It is not a Scene." });
    return payload.work ?? work;
  }

  async function savePanelEdits() {
    if (!selectedPersisted || !work) return;
    const before = snapshotOf(work);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "save-panel",
        panel_id: selectedPersisted.panel_id,
        patch: draftPanel,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.panel) {
      const next: StoryboardWorkRecord = {
        ...work,
        panels: work.panels.map((panel) => (panel.panel_id === payload.panel.panel_id ? payload.panel : panel)),
      };
      const after = snapshotOf(next);
      const nextHistory = pushHistory(history, {
        id: `${Date.now()}`,
        label: "Edit panel",
        kind: "authoring",
        reversible: true,
        persistent: true,
        undoHint: "Undo panel edit",
        before,
        after,
      });
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(work.work_id), serializeHistory(nextHistory));
      applyWork(next);
      setSaveState({ status: "ready", message: "Panel edits saved. AI will not overwrite this panel silently." });
    }
  }

  async function saveArtifactToPanel(
    panelId: string,
    patch: { still_url?: string; asset_id?: string; endpoint_ref?: string; playback_id?: string },
  ) {
    const panel = work?.panels.find((item) => item.panel_id === panelId);
    if (!panel || !work) return;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "save-panel",
        panel_id: panelId,
        patch: {
          ...(patch.still_url ? { still_url: patch.still_url } : {}),
          ...(patch.asset_id ? { active_still_asset_id: patch.asset_id } : {}),
          ...(patch.endpoint_ref ? { motion_endpoint: patch.endpoint_ref } : {}),
          ...(patch.playback_id ? { motion_playback_id: patch.playback_id } : {}),
          generation_metadata: {
            ...panel.generation_metadata,
            saved_artifact: { ...patch, saved_at: new Date().toISOString() },
          },
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.panel) {
      const next: StoryboardWorkRecord = {
        ...work,
        panels: work.panels.map((item) => (item.panel_id === payload.panel.panel_id ? payload.panel : item)),
      };
      applyWork(next);
      setMediaState({ status: "ready", message: "Artifact saved to panel." });
    }
  }

  async function confirmDeleteWorkspace() {
    if (!work?.work_id) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-work", work_id: work.work_id }),
    });
    const payload = await response.json().catch(() => ({}));
    setDeleteBusy(false);
    if (!response.ok || payload.deleted !== true) {
      setDeleteError(payload.error ?? "Storyboard could not be deleted.");
      return;
    }
    setDeleteOpen(false);
    onDeleted(backHref);
  }

  return {
    snapshotOf,
    applyWork,
    mutate,
    restoreFromSnapshot,
    saveBody,
    savePanelEdits,
    saveArtifactToPanel,
    confirmDeleteWorkspace,
  };
}

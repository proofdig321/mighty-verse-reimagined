"use client";

import { useEffect, useRef } from "react";
import { redoHistory, type AuthoringSnapshot, type HistoryState, undoHistory } from "@/lib/storyboard/history";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";

export function useStoryboardWorkspaceAutomation({
  dirty,
  history,
  playing,
  script,
  workTitle,
  selectedId,
  selectedPersisted,
  shotIds,
  work,
  saveBody,
  restoreFromSnapshot,
  mutate,
  setInspectorOpen,
  setResetOpen,
  setSelectedId,
}: {
  dirty: boolean;
  history: HistoryState;
  playing: boolean;
  script: string;
  workTitle: string;
  selectedId: string | null;
  selectedPersisted: StoryboardPanelRecord | null;
  shotIds: string[];
  work: StoryboardWorkRecord | null;
  saveBody: (nextBody?: string) => Promise<StoryboardWorkRecord | null>;
  restoreFromSnapshot: (snapshot: AuthoringSnapshot, nextHistory: HistoryState) => Promise<void>;
  mutate: (label: string, action: string, payload: Record<string, unknown>, kind?: "authoring" | "selection") => Promise<unknown>;
  setInspectorOpen: (next: boolean) => void;
  setResetOpen: (next: boolean) => void;
  setSelectedId: (next: string | null | ((current: string | null) => string | null)) => void;
}) {
  const saveBodyRef = useRef(saveBody);
  const restoreFromSnapshotRef = useRef(restoreFromSnapshot);
  const mutateRef = useRef(mutate);
  // eslint-disable-next-line react-hooks/refs
  saveBodyRef.current = saveBody;
  // eslint-disable-next-line react-hooks/refs
  restoreFromSnapshotRef.current = restoreFromSnapshot;
  // eslint-disable-next-line react-hooks/refs
  mutateRef.current = mutate;

  useEffect(() => {
    if (!playing || shotIds.length === 0) return;
    const timer = window.setInterval(() => {
      setSelectedId((current) => {
        const index = Math.max(0, shotIds.indexOf(current ?? shotIds[0]));
        return shotIds[(index + 1) % shotIds.length];
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [playing, shotIds, setSelectedId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveBodyRef.current();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = redoHistory(history);
          if (next) void restoreFromSnapshotRef.current(next.entry.after, next.state);
        } else {
          const next = undoHistory(history);
          if (next) void restoreFromSnapshotRef.current(next.entry.before, next.state);
        }
      }
      if (event.key === "Escape") {
        setResetOpen(false);
        setInspectorOpen(false);
      }
      if (!typing && (event.key === "Delete" || event.key === "Backspace") && selectedPersisted) {
        event.preventDefault();
        void mutateRef.current("Delete panel", "delete-panel", { panel_id: selectedPersisted.panel_id });
      }
      if (!typing && (event.key === "ArrowRight" || event.key === "ArrowLeft") && shotIds.length) {
        const index = Math.max(0, shotIds.indexOf(selectedId ?? shotIds[0]));
        const next = event.key === "ArrowRight" ? Math.min(shotIds.length - 1, index + 1) : Math.max(0, index - 1);
        setSelectedId(shotIds[next]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [history, selectedId, selectedPersisted, setInspectorOpen, setResetOpen, setSelectedId, shotIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dirty || !work?.work_id) return;
    const timer = window.setTimeout(() => {
      void saveBodyRef.current();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [dirty, script, workTitle, work?.work_id]);

  return null;
}

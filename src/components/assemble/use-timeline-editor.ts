"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";

export type TimelineClipItem = {
  panel_id: string;
  sequence: number;
  title: string;
  still_url: string | null;
  motion_endpoint: string | null;
  motion_playback_id: string | null;
  duration_ms: number;
};

const DEFAULT_CLIP_DURATION_MS = 5000;
const MIN_CLIP_DURATION_MS = 500;
const MAX_CLIP_DURATION_MS = 60000;

function panelToClip(panel: StoryboardPanelRecord): TimelineClipItem {
  return {
    panel_id: panel.panel_id,
    sequence: panel.sequence,
    title: panel.title || `Panel ${panel.sequence}`,
    still_url: panel.still_url,
    motion_endpoint:
      panel.motion_endpoint ??
      (panel.motion_playback_id
        ? `https://stream.mux.com/${panel.motion_playback_id}.m3u8`
        : null),
    motion_playback_id: panel.motion_playback_id,
    duration_ms: panel.duration_ms ?? DEFAULT_CLIP_DURATION_MS,
  };
}

function computeClipStart(clips: TimelineClipItem[], panelId: string): number {
  let cursor = 0;
  for (const clip of clips) {
    if (clip.panel_id === panelId) return cursor;
    cursor += clip.duration_ms;
  }
  return 0;
}

function computeClipAtMs(clips: TimelineClipItem[], ms: number): TimelineClipItem | null {
  let cursor = 0;
  for (const clip of clips) {
    if (ms >= cursor && ms < cursor + clip.duration_ms) return clip;
    cursor += clip.duration_ms;
  }
  return clips[clips.length - 1] ?? null;
}

export function useTimelineEditor({
  panels,
  onSaveDurations,
}: {
  panels: StoryboardPanelRecord[];
  onSaveDurations: (durations: Record<string, number>) => void;
}) {
  const [clips, setClips] = useState<TimelineClipItem[]>(() => panels.map(panelToClip));
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const totalDurationMsRef = useRef(0);
  const tickRef = useRef<(() => void) | null>(null);

  // Compute total duration — keep ref in sync via effect (not during render)
  const totalDurationMs = clips.reduce((sum, c) => sum + c.duration_ms, 0);
  useEffect(() => {
    totalDurationMsRef.current = totalDurationMs;
  }, [totalDurationMs]);

  // Stable tick — reads totalDurationMs via ref, calls itself via tickRef
  const tick = useCallback(() => {
    const now = performance.now();
    if (lastTickRef.current !== null) {
      const elapsed = now - lastTickRef.current;
      setPlayheadMs((prev) => {
        const next = prev + elapsed;
        if (next >= totalDurationMsRef.current) {
          setPlaying(false);
          return totalDurationMsRef.current;
        }
        return next;
      });
    }
    lastTickRef.current = now;
    if (tickRef.current) rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  // Keep tickRef current without writing during render
  useEffect(() => { tickRef.current = tick; }, [tick]);

  useEffect(() => {
    if (playing) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // Sync clips when panel IDs change
  const panelIdsKey = panels.map((p) => p.panel_id).join(",");
  useEffect(() => {
    const snapshot = panels;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClips((current) => {
      const byId = new Map(current.map((c) => [c.panel_id, c]));
      return snapshot.map((p) => byId.get(p.panel_id) ?? panelToClip(p));
    });
  }, [panelIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive active clip from playhead — no state needed
  const activeClipId = computeClipAtMs(clips, playheadMs)?.panel_id ?? null;

  function clipStartMs(panelId: string) {
    return computeClipStart(clips, panelId);
  }

  function clipAtMs(ms: number) {
    return computeClipAtMs(clips, ms);
  }

  function togglePlay() {
    if (playheadMs >= totalDurationMs) setPlayheadMs(0);
    setPlaying((v) => !v);
  }

  function restart() {
    setPlayheadMs(0);
    setPlaying(true);
  }

  function seekTo(ms: number) {
    setPlayheadMs(Math.max(0, Math.min(totalDurationMs, ms)));
  }

  function seekToClip(panelId: string) {
    seekTo(computeClipStart(clips, panelId));
    setSelectedClipId(panelId);
  }

  function setClipDuration(panelId: string, ms: number) {
    const clamped = Math.max(MIN_CLIP_DURATION_MS, Math.min(MAX_CLIP_DURATION_MS, ms));
    setClips((prev) =>
      prev.map((c) => (c.panel_id === panelId ? { ...c, duration_ms: clamped } : c)),
    );
  }

  function reorderClips(fromId: string, toId: string) {
    setClips((prev) => {
      const from = prev.findIndex((c) => c.panel_id === fromId);
      const to = prev.findIndex((c) => c.panel_id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function saveDurations() {
    const durations: Record<string, number> = {};
    for (const clip of clips) durations[clip.panel_id] = clip.duration_ms;
    onSaveDurations(durations);
  }

  return {
    clips,
    playheadMs,
    playing,
    muted,
    volume,
    zoom,
    selectedClipId,
    activeClipId,
    totalDurationMs,
    clipStartMs,
    clipAtMs,
    togglePlay,
    restart,
    seekTo,
    seekToClip,
    setClipDuration,
    reorderClips,
    setSelectedClipId,
    setMuted,
    setVolume,
    setZoom,
    saveDurations,
  };
}

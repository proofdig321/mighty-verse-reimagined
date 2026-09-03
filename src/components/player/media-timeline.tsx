"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { findActiveScene, formatDuration, sortSceneTimings, type SceneTiming } from "@/lib/media/timing";

type Props = {
  currentTime: number;
  duration: number;
  scenes?: SceneTiming[];
  activeSceneId?: string | null;
  onSeek: (seconds: number) => void;
  onSelectScene?: (scene: SceneTiming) => void;
};

export default function MediaTimeline({ currentTime, duration, scenes = [], activeSceneId, onSeek, onSelectScene }: Props) {
  const validScenes = useMemo(() => sortSceneTimings(scenes, duration * 1000), [scenes, duration]);
  const computedActiveId = activeSceneId ?? findActiveScene(validScenes, currentTime * 1000);
  const percentage = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  function seekFromPointer(clientX: number, element: HTMLDivElement) {
    if (!duration) return;
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    onSeek(ratio * duration);
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/70 p-3" aria-label="Media timeline">
      <div
        className="relative h-3 cursor-pointer rounded-full bg-muted"
        role="slider"
        tabIndex={0}
        aria-label="Seek media"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, duration)}
        aria-valuenow={currentTime}
        onClick={(event) => seekFromPointer(event.clientX, event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          onSeek(Math.max(0, Math.min(duration, currentTime + (event.key === "ArrowRight" ? 5 : -5))));
        }}
      >
        <div className="h-full rounded-full bg-accent-mv transition-[width]" style={{ width: `${percentage}%` }} />
        {validScenes.map((scene) => {
          const left = duration ? (scene.startMs / 1000 / duration) * 100 : 0;
          return (
            <button
              key={scene.id}
              type="button"
              aria-label={`Jump to ${scene.title ?? "scene"}`}
              title={scene.title ?? "Scene"}
              className={cn("absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground/60 transition-colors hover:bg-accent-mv", computedActiveId === scene.id && "bg-accent-mv")}
              style={{ left: `${left}%` }}
              onClick={(event) => { event.stopPropagation(); onSelectScene?.(scene); onSeek(scene.startMs / 1000); }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatDuration(currentTime)}</span>
        <span>{validScenes.length ? `${validScenes.length} scene markers` : "Scene timing unavailable"}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

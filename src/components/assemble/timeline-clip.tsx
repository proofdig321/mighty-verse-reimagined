"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { TimelineClipItem } from "./use-timeline-editor";

export function TimelineClip({
  clip,
  pxPerMs,
  isSelected,
  isActive,
  onSelect,
  onDurationChange,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  clip: TimelineClipItem;
  pxPerMs: number;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onDurationChange: (ms: number) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const width = Math.max(32, clip.duration_ms * pxPerMs);
  const resizeStartX = useRef<number | null>(null);
  const resizeStartDuration = useRef<number>(clip.duration_ms);

  function onResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartDuration.current = clip.duration_ms;

    function onMove(ev: MouseEvent) {
      if (resizeStartX.current === null) return;
      const delta = ev.clientX - resizeStartX.current;
      const newMs = resizeStartDuration.current + delta / pxPerMs;
      onDurationChange(newMs);
    }
    function onUp() {
      resizeStartX.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      className={cn(
        "timeline-clip",
        isSelected && "timeline-clip-selected",
        isActive && "timeline-clip-active",
        clip.motion_endpoint && "timeline-clip-has-motion",
      )}
      style={{ width }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      title={clip.title}
    >
      {/* Thumbnail */}
      {clip.still_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clip.still_url} alt="" className="timeline-clip-thumb" />
      ) : (
        <div className="timeline-clip-thumb timeline-clip-thumb-empty" />
      )}

      {/* Label */}
      <div className="timeline-clip-label">
        <span className="timeline-clip-seq">{String(clip.sequence).padStart(2, "0")}</span>
        <span className="timeline-clip-title">{clip.title}</span>
        {clip.motion_endpoint && <span className="timeline-clip-badge">▶</span>}
      </div>

      {/* Resize handle */}
      <div
        className="timeline-clip-resize"
        onMouseDown={onResizeMouseDown}
        title="Drag to adjust duration"
      />
    </div>
  );
}

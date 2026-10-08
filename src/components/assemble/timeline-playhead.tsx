"use client";

import { useRef } from "react";

export function TimelinePlayhead({
  positionMs,
  totalMs,
  pxPerMs,
  trackHeight,
  onSeek,
}: {
  positionMs: number;
  totalMs: number;
  pxPerMs: number;
  trackHeight: number;
  onSeek: (ms: number) => void;
}) {
  const left = totalMs > 0 ? (positionMs / totalMs) * (totalMs * pxPerMs) : 0;
  const dragStartX = useRef<number | null>(null);
  const dragStartMs = useRef<number>(positionMs);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartMs.current = positionMs;

    function onMove(ev: MouseEvent) {
      if (dragStartX.current === null) return;
      const delta = ev.clientX - dragStartX.current;
      const newMs = Math.max(0, Math.min(totalMs, dragStartMs.current + delta / pxPerMs));
      onSeek(newMs);
    }
    function onUp() {
      dragStartX.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      className="timeline-playhead"
      style={{ left, height: trackHeight }}
      onMouseDown={onMouseDown}
      title="Drag to scrub"
    >
      <div className="timeline-playhead-head" />
      <div className="timeline-playhead-line" />
    </div>
  );
}

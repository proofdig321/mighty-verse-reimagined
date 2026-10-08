"use client";

import { cn } from "@/lib/utils";

function formatRulerMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TimelineRuler({
  totalMs,
  pxPerMs,
  className,
}: {
  totalMs: number;
  pxPerMs: number;
  className?: string;
}) {
  if (totalMs <= 0) return null;

  // Pick a tick interval that gives ~60–120px between ticks
  const targetPx = 80;
  const rawInterval = targetPx / pxPerMs; // ms
  const intervals = [500, 1000, 2000, 5000, 10000, 30000, 60000];
  const interval = intervals.find((i) => i >= rawInterval) ?? intervals[intervals.length - 1];

  const ticks: number[] = [];
  for (let t = 0; t <= totalMs; t += interval) ticks.push(t);

  return (
    <div className={cn("timeline-ruler", className)} style={{ width: totalMs * pxPerMs }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="timeline-ruler-tick"
          style={{ left: t * pxPerMs }}
        >
          <span className="timeline-ruler-label">{formatRulerMs(t)}</span>
        </div>
      ))}
    </div>
  );
}

"use client";

import Image from "next/image";
import { X, GripVertical, Play } from "lucide-react";
import { useRef, useState } from "react";
import type { AssemblyItem } from "./types";

type Props = {
  items: AssemblyItem[];
  onReorder: (items: AssemblyItem[]) => void;
  onRemove: (key: string) => void;
  onPreview: (index: number) => void;
};

function formatDur(sec: number | null) {
  if (sec == null) return null;
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function totalDuration(items: AssemblyItem[]) {
  const sec = items.reduce((a, i) => a + (i.durationSec ?? 0), 0);
  return formatDur(sec);
}

export default function AssemblyCanvas({ items, onReorder, onRemove, onPreview }: Props) {
  const dragIdx = useRef<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  function onDragStart(i: number) { dragIdx.current = i; }
  function onDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDropIdx(i); }
  function onDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from == null || from === i) { setDropIdx(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onReorder(next);
    dragIdx.current = null;
    setDropIdx(null);
  }
  function onDragEnd() { dragIdx.current = null; setDropIdx(null); }

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-center px-8">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in oklch, var(--accent-mv) 10%, var(--card))", border: "1px dashed color-mix(in oklch, var(--accent-mv) 40%, transparent)" }}
        >
          <span className="text-2xl" style={{ color: "var(--accent-mv)" }}>+</span>
        </div>
        <p className="text-sm font-medium text-foreground">Your experience is empty</p>
        <p className="text-xs text-muted-foreground">Add scenes from the library to build your timeline</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Timeline header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Timeline</p>
          <p className="text-xs text-muted-foreground mt-0.5">{items.length} scene{items.length !== 1 ? "s" : ""} · {totalDuration(items)}</p>
        </div>
      </div>

      {/* Timeline ruler */}
      <div className="px-4 py-2 border-b border-border/50 flex items-center gap-1 overflow-x-auto scrollbar-hidden">
        <span className="text-[9px] text-muted-foreground shrink-0 w-8">00:00</span>
        {items.map((item, i) => {
          const widthPct = item.durationSec ? Math.max(8, item.durationSec / 2.55) : 8;
          return (
            <div
              key={item.key}
              className="shrink-0 h-5 rounded flex items-center justify-center overflow-hidden"
              style={{
                width: `${widthPct}%`,
                minWidth: 40,
                background: i % 2 === 0
                  ? "color-mix(in oklch, var(--accent-mv) 20%, var(--card))"
                  : "color-mix(in oklch, var(--accent-mv) 12%, var(--card))",
                border: "1px solid color-mix(in oklch, var(--accent-mv) 30%, transparent)",
              }}
            >
              <span className="text-[8px] font-medium truncate px-1" style={{ color: "var(--accent-mv)" }}>
                {item.title ?? `Scene ${i + 1}`}
              </span>
            </div>
          );
        })}
        <span className="text-[9px] text-muted-foreground shrink-0 ml-1">{totalDuration(items)}</span>
      </div>

      {/* Scene cards */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden p-4 space-y-2">
        {items.map((item, i) => (
          <div
            key={item.key}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={onDragEnd}
            className="flex items-center gap-3 rounded-lg border p-2 transition-all cursor-grab active:cursor-grabbing"
            style={{
              background: dropIdx === i ? "color-mix(in oklch, var(--accent-mv) 10%, var(--card))" : "var(--card)",
              borderColor: dropIdx === i ? "var(--accent-mv)" : "var(--border)",
            }}
          >
            {/* Drag handle */}
            <GripVertical size={14} className="shrink-0 text-muted-foreground" />

            {/* Index */}
            <span
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: "color-mix(in oklch, var(--accent-mv) 20%, var(--card))", color: "var(--accent-mv)" }}
            >
              {i + 1}
            </span>

            {/* Thumbnail */}
            <div className="relative shrink-0 overflow-hidden rounded" style={{ width: 56, height: 36, background: "var(--muted)" }}>
              {item.thumbnailUrl ? (
                <Image src={item.thumbnailUrl} alt={item.title ?? "Scene"} fill className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] font-bold" style={{ color: "var(--accent-mv)" }}>MV</span>
                </div>
              )}
            </div>

            {/* Title + duration */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title ?? "Untitled"}</p>
              {item.durationSec != null && (
                <p className="text-xs text-muted-foreground">{formatDur(item.durationSec)}</p>
              )}
            </div>

            {/* Preview */}
            <button
              type="button"
              onClick={() => onPreview(i)}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-border hover:border-[var(--accent-mv)] transition-colors"
              aria-label="Preview from this scene"
            >
              <Play size={11} style={{ color: "var(--accent-mv)" }} />
            </button>

            {/* Remove */}
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-border hover:border-destructive hover:text-destructive transition-colors text-muted-foreground"
              aria-label="Remove from experience"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

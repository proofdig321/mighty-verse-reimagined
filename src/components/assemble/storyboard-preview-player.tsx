"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Play, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";

type PreviewPanel = {
  panel_id: string;
  sequence: number;
  title: string;
  description: string | null;
  still_url: string | null;
  motion_endpoint: string | null;
  motion_playback_id: string | null;
};

export function StoryboardPreviewPlayer({ panels }: { panels: PreviewPanel[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(panels[0]?.panel_id ?? null);

  const index = panels.findIndex((p) => p.panel_id === selectedId);
  const current = index >= 0 ? panels[index] : panels[0] ?? null;

  const endpoint = current
    ? (current.motion_endpoint ?? (current.motion_playback_id
        ? `https://stream.mux.com/${current.motion_playback_id}.m3u8`
        : null))
    : null;

  function prev() {
    if (index > 0) setSelectedId(panels[index - 1].panel_id);
  }
  function next() {
    if (index < panels.length - 1) setSelectedId(panels[index + 1].panel_id);
  }

  if (!current) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        No panels yet
      </div>
    );
  }

  return (
    <div className="storyboard-preview-player">
      {/* Main stage */}
      <div className="storyboard-preview-stage">
        {endpoint ? (
          <StoryboardHlsPreview endpoint={endpoint} poster={current.still_url} label={current.title} />
        ) : current.still_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.still_url} alt={current.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 studio-panel-card-placeholder" />
        )}

        {/* Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 py-4 pointer-events-none">
          <p className="font-mono text-[10px] text-white/50 mb-0.5">
            {String(current.sequence).padStart(2, "0")} / {String(panels.length).padStart(2, "0")}
          </p>
          <p className="text-base font-semibold text-white">{current.title || "Untitled panel"}</p>
          {current.description && (
            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{current.description}</p>
          )}
        </div>

        {/* Nav arrows */}
        <button type="button" onClick={prev} disabled={index === 0}
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
            index === 0 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/70"
          )}
          aria-label="Previous panel">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <button type="button" onClick={next} disabled={index === panels.length - 1}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
            index === panels.length - 1 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/70"
          )}
          aria-label="Next panel">
          <ChevronRight size={18} className="text-white" />
        </button>

        {/* Media type badge */}
        <div className="absolute top-3 left-3 pointer-events-none">
          {endpoint ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white/80 font-medium">
              <Play size={9} /> Video
            </span>
          ) : current.still_url ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white/80 font-medium">
              <Layers size={9} /> Still
            </span>
          ) : null}
        </div>
      </div>

      {/* Filmstrip */}
      <div className="storyboard-preview-strip">
        {panels.map((panel) => {
          const isActive = panel.panel_id === current.panel_id;
          const hasMotion = Boolean(panel.motion_endpoint || panel.motion_playback_id);
          return (
            <button key={panel.panel_id} type="button"
              onClick={() => setSelectedId(panel.panel_id)}
              aria-current={isActive ? "true" : undefined}
              className={cn("storyboard-preview-thumb", isActive && "storyboard-preview-thumb-active")}
            >
              {panel.still_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={panel.still_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 studio-panel-card-placeholder" />
              )}
              {hasMotion && (
                <span className="absolute top-0.5 right-0.5 text-[8px] text-white/70">▶</span>
              )}
              <span className="absolute bottom-0 inset-x-0 text-center font-mono text-[7px] text-white/60 bg-black/40 leading-tight py-px">
                {String(panel.sequence).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

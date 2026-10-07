"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";

/**
 * StoryboardPanelSlideshow — reusable inline panel preview.
 *
 * Renders a full-bleed 16:9 slideshow of assembled panels.
 * Controlled externally via selectedId / onSelect so the workspace
 * drives selection state — this component owns only navigation.
 */
export function StoryboardPanelSlideshow({
  panels,
  panelStills,
  selectedId,
  onSelect,
  onClose,
}: {
  panels: StoryboardPanelRecord[];
  panelStills: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const index = panels.findIndex((p) => p.panel_id === selectedId);
  const current = index >= 0 ? panels[index] : panels[0] ?? null;
  const still = current ? (panelStills[current.panel_id] ?? current.still_url ?? null) : null;

  function prev() {
    const i = panels.findIndex((p) => p.panel_id === current?.panel_id);
    if (i > 0) onSelect(panels[i - 1].panel_id);
  }

  function next() {
    const i = panels.findIndex((p) => p.panel_id === current?.panel_id);
    if (i < panels.length - 1) onSelect(panels[i + 1].panel_id);
  }

  if (!current) return null;

  const currentIndex = panels.findIndex((p) => p.panel_id === current.panel_id);

  return (
    <div className="storyboard-slideshow" data-storyboard-slideshow="true">
      {/* Main frame */}
      <div className="storyboard-slideshow-frame">
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={still} alt={current.title ?? ""} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 studio-panel-card-placeholder" />
        )}

        {/* Overlay: title + sequence */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
          <p className="font-mono text-[10px] text-white/50 mb-0.5">
            {String(current.sequence).padStart(2, "0")} / {String(panels.length).padStart(2, "0")}
          </p>
          <p className="text-sm font-medium text-white truncate">{current.title || "Untitled panel"}</p>
          {current.description && (
            <p className="text-xs text-white/60 line-clamp-1 mt-0.5">{current.description}</p>
          )}
        </div>

        {/* Nav arrows */}
        <button
          type="button"
          onClick={prev}
          disabled={currentIndex === 0}
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
            currentIndex === 0 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/70"
          )}
          aria-label="Previous panel"
        >
          <ChevronLeft size={14} className="text-white" />
        </button>
        <button
          type="button"
          onClick={next}
          disabled={currentIndex === panels.length - 1}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center transition-opacity",
            currentIndex === panels.length - 1 ? "opacity-20 cursor-not-allowed" : "hover:bg-black/70"
          )}
          aria-label="Next panel"
        >
          <ChevronRight size={14} className="text-white" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          aria-label="Close preview"
        >
          <X size={11} className="text-white" />
        </button>
      </div>

      {/* Filmstrip */}
      <div className="storyboard-slideshow-strip">
        {panels.map((panel) => {
          const thumb = panelStills[panel.panel_id] ?? panel.still_url ?? null;
          const isActive = panel.panel_id === current.panel_id;
          return (
            <button
              key={panel.panel_id}
              type="button"
              onClick={() => onSelect(panel.panel_id)}
              className={cn(
                "storyboard-slideshow-thumb",
                isActive && "storyboard-slideshow-thumb-active"
              )}
              aria-current={isActive ? "true" : undefined}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 studio-panel-card-placeholder" />
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

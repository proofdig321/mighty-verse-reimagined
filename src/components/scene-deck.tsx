"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Dices, LayoutGrid, Rows3 } from "lucide-react";
import MediaVisual from "@/components/media-visual";
import { Button } from "@/components/ui/button";

export type SceneDeckItem = {
  id: string;
  title: string | null;
  href?: string;
  playbackId?: string | null;
};

type Props = {
  scenes: SceneDeckItem[];
  description?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When true, cards without media are face-down until selected. Default: true */
  faceDownUntilSelected?: boolean;
};

function shuffleItems(items: SceneDeckItem[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function SceneDeck({
  scenes,
  description = "Shuffle the deck to reveal hidden creative moments. Create your own timeline.",
  selectedId,
  onSelect,
  faceDownUntilSelected = true,
}: Props) {
  const [items, setItems] = useState(scenes);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? scenes[0]?.id ?? null
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [gridView, setGridView] = useState(false);
  const draggedInteraction = useRef(false);
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(scenes);
    setInternalSelectedId(selectedId ?? scenes[0]?.id ?? null);
  }, [scenes, selectedId]);

  const activeId = selectedId ?? internalSelectedId;

  function selectScene(id: string) {
    setInternalSelectedId(id);
    onSelect?.(id);
    // scroll selected card into view
    if (deckRef.current) {
      const card = deckRef.current.querySelector(`[data-scene-id="${id}"]`) as HTMLElement | null;
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === draggedId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDropTargetId(null);
    setDraggedId(null);
  }

  function moveByKeyboard(id: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function sceneCard(scene: SceneDeckItem, index: number) {
    const isSelected = activeId === scene.id;
    const hasFaceContent = !!scene.playbackId;
    // Face-down: no media AND (faceDownUntilSelected AND not selected)
    const isFaceDown = !hasFaceContent && faceDownUntilSelected && !isSelected;

    return (
      <div
        data-scene-id={scene.id}
        role="button"
        tabIndex={0}
        draggable
        onClick={() => selectScene(scene.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectScene(scene.id); }
        }}
        onDragStart={() => { draggedInteraction.current = true; setDraggedId(scene.id); }}
        onDragOver={(e) => { e.preventDefault(); setDropTargetId(scene.id); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(scene.id); }}
        onDragEnd={() => {
          setDraggedId(null);
          setDropTargetId(null);
          window.setTimeout(() => { draggedInteraction.current = false; }, 200);
        }}
        aria-label={`Scene ${index + 1}: ${scene.title ?? "Undisclosed"}`}
        aria-pressed={isSelected}
        className={[
          "scene-deck-card",
          `scene-deck-card-${index % 5}`,
          isSelected ? "scene-deck-card-selected" : "",
          draggedId === scene.id ? "scene-deck-card-dragging" : "",
          dropTargetId === scene.id && draggedId !== scene.id ? "scene-deck-card-drop-target" : "",
        ].filter(Boolean).join(" ")}
      >
        {/* Face content */}
        {hasFaceContent ? (
          <MediaVisual
            playbackId={scene.playbackId}
            title={scene.title ?? "Scene"}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <>
            {/* Decorative inner frame — always visible */}
            <span className="scene-deck-mark" aria-hidden="true">MV</span>
            <span className="scene-deck-lines" aria-hidden="true" />
          </>
        )}

        {/* Scene number badge — always visible */}
        <span className="absolute left-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: isSelected ? "var(--accent-mv-gold)" : "color-mix(in oklch, var(--accent-mv) 30%, var(--background))",
            color: isSelected ? "#000" : "var(--accent-mv)",
            border: `1px solid ${isSelected ? "var(--accent-mv-gold)" : "color-mix(in oklch, var(--accent-mv) 50%, transparent)"}`,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Title — only shown when selected OR has media (face-up) */}
        {!isFaceDown && (
          <span className="absolute inset-x-3 bottom-10 z-10 text-sm font-semibold text-white drop-shadow-lg leading-tight">
            {scene.title ?? "Undisclosed Scene"}
          </span>
        )}

        {/* Face-down label — shown when face-down */}
        {isFaceDown && (
          <span className="absolute inset-x-3 bottom-10 z-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-center"
            style={{ color: "color-mix(in oklch, var(--accent-mv) 55%, transparent)" }}
          >
            Tap to reveal
          </span>
        )}

        {/* Reorder controls */}
        <span className="absolute bottom-2 right-2 z-20 flex gap-1">
          <button
            type="button"
            aria-label={`Move ${scene.title ?? "scene"} earlier`}
            disabled={index === 0}
            onClick={(e) => { e.stopPropagation(); moveByKeyboard(scene.id, -1); }}
            className="rounded bg-black/60 px-1.5 py-1 text-[10px] text-white disabled:opacity-30 hover:bg-black/80"
          >←</button>
          <button
            type="button"
            aria-label={`Move ${scene.title ?? "scene"} later`}
            disabled={index === items.length - 1}
            onClick={(e) => { e.stopPropagation(); moveByKeyboard(scene.id, 1); }}
            className="rounded bg-black/60 px-1.5 py-1 text-[10px] text-white disabled:opacity-30 hover:bg-black/80"
          >→</button>
        </span>
      </div>
    );
  }

  return (
    <section className="space-y-0" aria-labelledby="scene-deck-heading">

      {/* Header row — heading + description left, controls right */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Children of the Mural</p>
          <h2
            id="scene-deck-heading"
            className="mt-1 text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Scene Deck
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => shuffleItems(current))}
            aria-label="Shuffle scenes"
          >
            <Dices size={14} />
            Shuffle
          </Button>
          <Button
            type="button"
            variant={gridView ? "default" : "outline"}
            size="sm"
            onClick={() => setGridView((v) => !v)}
            aria-label="Toggle grid view"
            aria-pressed={gridView}
          >
            {gridView ? <Rows3 size={14} /> : <LayoutGrid size={14} />}
            {gridView ? "Deck" : "Grid View"}
          </Button>
        </div>
      </div>

      {/* Grid view */}
      {gridView ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-4">
          {items.map((scene, index) => {
            const isSelected = activeId === scene.id;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => selectScene(scene.id)}
                className={[
                  "relative overflow-hidden rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-[var(--accent-mv-gold)] shadow-[0_0_0_2px_color-mix(in_oklch,var(--accent-mv-gold)_40%,transparent)]"
                    : "border-border hover:border-[var(--accent-mv)]",
                ].join(" ")}
                style={{
                  background: "linear-gradient(135deg, color-mix(in oklch, var(--accent-mv) 20%, var(--card)), var(--card))",
                  aspectRatio: "3/4",
                }}
              >
                {scene.playbackId ? (
                  <MediaVisual playbackId={scene.playbackId} title={scene.title ?? "Scene"} className="absolute inset-0 h-full w-full border-0" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold tracking-widest" style={{ color: "var(--accent-mv)" }}>MV</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-xs font-semibold text-white truncate">{scene.title ?? `Scene ${index + 1}`}</p>
                </div>
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: isSelected ? "var(--accent-mv-gold)" : "rgba(0,0,0,0.6)", color: isSelected ? "#000" : "#fff" }}
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Deck view */
        <div ref={deckRef} className="scene-deck" aria-label={`${items.length} Scenes`}>
          {items.map((scene, index) => (
            <div key={scene.id} className="shrink-0">
              {scene.href ? (
                <Link
                  href={scene.href}
                  className="block"
                  onClick={(e) => {
                    if (draggedInteraction.current || draggedId) {
                      e.preventDefault();
                      draggedInteraction.current = false;
                    }
                  }}
                >
                  {sceneCard(scene, index)}
                </Link>
              ) : (
                sceneCard(scene, index)
              )}
            </div>
          ))}
        </div>
      )}

      {/* Deck timeline — positional scrubber */}
      {!gridView && items.length > 0 && (
        <div className="pt-2 pb-1 space-y-2">
          <div className="relative flex items-center gap-0 px-1">
            {/* Track line */}
            <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border" />
            {/* Scene markers */}
            <div className="relative flex w-full items-center justify-between">
              {items.map((scene, index) => {
                const isActive = activeId === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    aria-label={`Go to scene ${index + 1}${scene.title ? `: ${scene.title}` : ""}`}
                    title={scene.title ?? `Scene ${index + 1}`}
                    onClick={() => selectScene(scene.id)}
                    className="relative flex flex-col items-center gap-1.5 group"
                  >
                    <span
                      className="block rounded-full transition-all duration-150"
                      style={{
                        width: isActive ? "14px" : "8px",
                        height: isActive ? "14px" : "8px",
                        background: isActive ? "var(--accent-mv-gold)" : "color-mix(in oklch, var(--accent-mv) 50%, var(--border))",
                        boxShadow: isActive ? "0 0 0 3px color-mix(in oklch, var(--accent-mv-gold) 30%, transparent)" : "none",
                      }}
                    />
                    {isActive && (
                      <span className="absolute top-5 text-[9px] font-semibold whitespace-nowrap"
                        style={{ color: "var(--accent-mv-gold)" }}
                      >
                        {scene.title ?? `Scene ${index + 1}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-5">
            Drag cards to reorder your timeline.
          </p>
        </div>
      )}
    </section>
  );
}

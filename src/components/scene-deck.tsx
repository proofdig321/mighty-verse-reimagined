"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Dices, GripVertical } from "lucide-react";
import MediaVisual from "@/components/media-visual";
import { Button } from "@/components/ui/button";

export type SceneDeckItem = { id: string; title: string | null; href?: string; playbackId?: string | null };

type Props = { scenes: SceneDeckItem[]; description?: string; selectedId?: string | null; onSelect?: (id: string) => void };

function shuffleItems(items: SceneDeckItem[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function SceneDeck({ scenes, description = "Explore the scenes and creative moments inside this World.", selectedId, onSelect }: Props) {
  const [items, setItems] = useState(scenes);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(scenes[0]?.id ?? null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const draggedInteraction = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(scenes);
    setInternalSelectedId(selectedId ?? scenes[0]?.id ?? null);
  }, [scenes, selectedId]);

  function selectScene(id: string) {
    setInternalSelectedId(id);
    onSelect?.(id);
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

  return (
    <section className="space-y-5" aria-labelledby="scene-deck-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Children of the Mural</p>
          <h2 id="scene-deck-heading" className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-display, inherit)" }}>Scene Deck</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => shuffleItems(current))} aria-label="Shuffle scenes" title="Shuffle scenes">
          <Dices size={15} /> Shuffle scenes
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="scene-deck" aria-label={`${items.length} Scenes`}>
        {items.map((scene, index) => (
          <div key={scene.id} className="shrink-0">
            {scene.href ? <Link href={scene.href} className="block" onClick={(event) => { if (draggedInteraction.current || draggedId) { event.preventDefault(); draggedInteraction.current = false; } }}>{sceneCard(scene, index)}</Link> : sceneCard(scene, index)}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Drag a card to change the presentation order.</p>
    </section>
  );

  function sceneCard(scene: SceneDeckItem, index: number) {
    return (
      <div
        role="button"
        tabIndex={0}
        draggable
        onClick={() => selectScene(scene.id)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectScene(scene.id); } }}
        onDragStart={() => { draggedInteraction.current = true; setDraggedId(scene.id); }}
        onDragOver={(event) => { event.preventDefault(); setDropTargetId(scene.id); }}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); moveItem(scene.id); }}
        onDragEnd={() => { setDraggedId(null); setDropTargetId(null); window.setTimeout(() => { draggedInteraction.current = false; }, 200); }}
        aria-label={`Scene ${index + 1}: ${scene.title ?? "Untitled"}`}
              className={`scene-deck-card scene-deck-card-${index % 5} ${(selectedId ?? internalSelectedId) === scene.id ? "scene-deck-card-selected" : ""} ${draggedId === scene.id ? "scene-deck-card-dragging" : ""} ${dropTargetId === scene.id && draggedId !== scene.id ? "scene-deck-card-drop-target" : ""}`}
      >
        {scene.playbackId ? <MediaVisual playbackId={scene.playbackId} title={scene.title ?? "Scene"} className="absolute inset-0 h-full w-full border-0" /> : <><span className="scene-deck-mark" aria-hidden="true">MV</span><span className="scene-deck-lines" aria-hidden="true" /></>}
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white/90"><GripVertical size={11} /> {String(index + 1).padStart(2, "0")}</span>
        <span className="absolute inset-x-4 bottom-4 z-10 text-sm font-medium text-white drop-shadow-md">{scene.title ?? "Undisclosed Scene"}</span>
        <span className="absolute bottom-3 right-3 z-20 flex gap-1">
          <button type="button" aria-label={`Move ${scene.title ?? "scene"} earlier`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveByKeyboard(scene.id, -1); }} className="rounded bg-black/60 px-1.5 py-1 text-[10px] text-white disabled:opacity-40">←</button>
          <button type="button" aria-label={`Move ${scene.title ?? "scene"} later`} disabled={index === items.length - 1} onClick={(event) => { event.stopPropagation(); moveByKeyboard(scene.id, 1); }} className="rounded bg-black/60 px-1.5 py-1 text-[10px] text-white disabled:opacity-40">→</button>
        </span>
      </div>
    );
  }
}
"use client";

import Link from "next/link";
import { useState } from "react";

export type SceneDeckItem = { id: string; title: string | null; href: string };

type Props = { scenes: SceneDeckItem[] };

export default function SceneDeck({ scenes }: Props) {
  const [items, setItems] = useState(scenes);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function shuffle() { setItems((current) => [...current].sort(() => Math.random() - 0.5)); }

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
    setDraggedId(null);
  }

  return (
    <section className="space-y-5" aria-labelledby="scene-deck-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Children of the Mural</p>
          <h2 id="scene-deck-heading" className="mt-1 text-3xl font-semibold" style={{ fontFamily: "var(--font-display, inherit)" }}>Scene Deck</h2>
        </div>
        <button type="button" onClick={shuffle} className="border border-foreground/20 px-4 py-2 text-sm font-medium hover:border-foreground/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2">Shuffle</button>
      </div>
      <p className="text-sm text-muted-foreground">Explore the hidden creative moments inside this Mural.</p>
      <div className="scene-deck" aria-label={`${items.length} Scenes`}>
        {items.map((scene, index) => (
          <Link
            key={scene.id}
            href={scene.href}
            draggable
            onDragStart={() => setDraggedId(scene.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveItem(scene.id)}
            onDragEnd={() => setDraggedId(null)}
            aria-label={scene.title ? `Open Scene: ${scene.title}` : "Open Scene"}
            className={`scene-deck-card scene-deck-card-${index % 5}${draggedId === scene.id ? " opacity-50" : ""}`}
          >
            <span className="scene-deck-mark" aria-hidden="true">MV</span>
            <span className="scene-deck-lines" aria-hidden="true" />
            <span className="sr-only">{scene.title ?? "Undisclosed Scene"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
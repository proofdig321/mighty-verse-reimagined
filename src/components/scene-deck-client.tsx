"use client";

import { useState } from "react";
import Link from "next/link";
import { Dices, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

type Props = { scenes: SceneItem[] };

export default function SceneDeckClient({ scenes }: Props) {
  const [order, setOrder] = useState<SceneItem[]>(scenes);
  const [selected, setSelected] = useState<string | null>(order[0]?.master_id ?? null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function shuffle() {
    setOrder((prev) => {
      const next = [...prev];
      if (next.length > 1) next.push(next.shift()!);
      return next;
    });
  }

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setOrder((current) => {
      const from = current.findIndex((item) => item.master_id === draggedId);
      const to = current.findIndex((item) => item.master_id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId(null);
  }

  if (order.length === 0) {
    return <p className="text-sm text-muted-foreground">No scenes yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={shuffle}
          style={{ borderColor: "var(--accent-mv)", color: "var(--accent-mv)" }}
        >
          <Dices size={14} /> Shuffle scenes
        </Button>
      </div>

      <div className="scene-deck">
        {order.map((s, i) => (
          <SceneCard
            key={s.master_id}
            scene={s}
            index={i}
            selected={selected === s.master_id}
            onSelect={setSelected}
            dragged={draggedId === s.master_id}
            onDragStart={setDraggedId}
            onDrop={moveItem}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center">Drag cards to reorder your timeline</p>
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  index,
  selected,
  onSelect,
  dragged,
  onDragStart,
  onDrop,
}: {
  scene: SceneItem;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  dragged: boolean;
  onDragStart: (id: string | null) => void;
  onDrop: (id: string) => void;
}) {
  const cardClass = `scene-deck-card scene-deck-card-${index % 5}`;

  const inner = (
    <div
      onClick={() => onSelect(scene.master_id)}
      draggable
      onDragStart={() => onDragStart(scene.master_id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); onDrop(scene.master_id); }}
      onDragEnd={() => onDragStart(null)}
      aria-label={`Scene ${index + 1}: ${scene.title ?? "Untitled"}`}
      className={`${cardClass} cursor-grab ${dragged ? "scale-95 opacity-50" : ""}`}
      style={selected ? { borderColor: "var(--accent-mv-gold)", boxShadow: `0 0 16px var(--accent-mv-gold)` } : undefined}
    >
      <div className="scene-deck-lines" />
      <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/80"><GripVertical size={11} /> {String(index + 1).padStart(2, "0")}</div>
      <div className="scene-deck-mark">◈</div>
      <div className="absolute bottom-0 inset-x-0 p-4">
        <p className="text-xs font-medium text-foreground text-center leading-tight line-clamp-3 relative z-10">
          {scene.title ?? "Scene"}
        </p>
      </div>
    </div>
  );

  if (scene.projection_id) {
    return (
      <Link href={`/moments/${scene.projection_id}`} className="shrink-0 block">
        {inner}
      </Link>
    );
  }
  return <div className="shrink-0">{inner}</div>;
}

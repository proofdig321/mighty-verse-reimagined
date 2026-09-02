"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

type Props = { scenes: SceneItem[] };

export default function SceneDeckClient({ scenes }: Props) {
  const [order, setOrder] = useState<SceneItem[]>(scenes);
  const [gridView, setGridView] = useState(false);
  const [selected, setSelected] = useState<string | null>(order[0]?.master_id ?? null);

  function shuffle() {
    setOrder((prev) => {
      const next = [...prev];
      next.push(next.shift()!);
      return next;
    });
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
          ✦ Shuffle
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGridView((v) => !v)}
        >
          {gridView ? "Deck View" : "Grid View"}
        </Button>
      </div>

      {gridView ? (
        <div className="scene-deck">
          {order.map((s, i) => (
            <SceneCard
              key={s.master_id}
              scene={s}
              index={i}
              selected={selected === s.master_id}
              onSelect={setSelected}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {order.map((s, i) => (
            <SceneCard
              key={s.master_id}
              scene={s}
              index={i}
              selected={selected === s.master_id}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {/* Timeline scrubber */}
      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(order.length - 1, 1)}
          defaultValue={0}
          className="w-full accent-[var(--accent-mv)]"
          style={{ accentColor: "var(--accent-mv)" }}
          readOnly
        />
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
}: {
  scene: SceneItem;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const cardClass = `scene-deck-card scene-deck-card-${index % 5}`;

  const inner = (
    <div
      onClick={() => onSelect(scene.master_id)}
      className={`${cardClass} cursor-pointer`}
      style={selected ? { borderColor: "var(--accent-mv-gold)", boxShadow: `0 0 16px var(--accent-mv-gold)` } : undefined}
    >
      <div className="scene-deck-lines" />
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

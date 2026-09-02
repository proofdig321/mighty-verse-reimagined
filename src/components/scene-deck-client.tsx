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
      // Rotate: move first item to end
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {order.map((s) => (
            <SceneCard key={s.master_id} scene={s} selected={selected === s.master_id} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {order.map((s) => (
            <SceneCard key={s.master_id} scene={s} selected={selected === s.master_id} onSelect={setSelected} />
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
  selected,
  onSelect,
}: {
  scene: SceneItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const inner = (
    <div
      onClick={() => onSelect(scene.master_id)}
      className="shrink-0 w-32 cursor-pointer"
    >
      <div
        className="w-32 h-48 rounded-xl border-2 flex flex-col items-center justify-center p-3 transition-all"
        style={{
          background: "var(--card)",
          borderColor: selected ? "var(--accent-mv-gold)" : "var(--border)",
          boxShadow: selected ? `0 0 12px var(--accent-mv-gold)` : undefined,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: "var(--accent-mv)" }}
        >
          <span className="text-white text-sm">◈</span>
        </div>
        <p className="text-xs font-medium text-foreground text-center leading-tight line-clamp-3">
          {scene.title ?? "Scene"}
        </p>
      </div>
    </div>
  );

  if (scene.projection_id) {
    return (
      <Link href={`/moments/${scene.projection_id}`} className="shrink-0">
        {inner}
      </Link>
    );
  }
  return inner;
}

"use client";

import Image from "next/image";
import { Plus, Check } from "lucide-react";
import type { LibraryScene, AssemblyItem } from "./types";

type Props = {
  scenes: LibraryScene[];
  assembly: AssemblyItem[];
  onAdd: (scene: LibraryScene) => void;
};

function formatDur(sec: number | null) {
  if (sec == null) return null;
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function SceneLibrary({ scenes, assembly, onAdd }: Props) {
  const addedIds = new Set(assembly.map(a => a.projectionId));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Scene Library</p>
        <p className="text-xs text-muted-foreground mt-0.5">{scenes.length} scenes available</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden divide-y divide-border">
        {scenes.map((scene) => {
          const inAssembly = addedIds.has(scene.projectionId);
          const dur = formatDur(scene.durationSec);

          return (
            <div key={scene.projectionId} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
              {/* Thumbnail */}
              <div
                className="relative shrink-0 overflow-hidden rounded"
                style={{ width: 72, height: 48, background: "var(--card)" }}
              >
                {scene.thumbnailUrl ? (
                  <Image
                    src={scene.thumbnailUrl}
                    alt={scene.title ?? "Scene"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold tracking-widest" style={{ color: "var(--accent-mv)" }}>MV</span>
                  </div>
                )}
                {dur && (
                  <span className="absolute bottom-1 right-1 rounded px-1 text-[9px] font-semibold text-white bg-black/70">
                    {dur}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground truncate">{scene.title ?? "Untitled Scene"}</p>
                {scene.muralTitle && (
                  <p className="text-xs text-muted-foreground truncate">{scene.muralTitle}</p>
                )}
              </div>

              {/* Add button */}
              <button
                type="button"
                onClick={() => onAdd(scene)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
                style={{
                  borderColor: inAssembly ? "var(--accent-mv)" : "var(--border)",
                  background: inAssembly ? "color-mix(in oklch, var(--accent-mv) 15%, var(--card))" : "transparent",
                  color: inAssembly ? "var(--accent-mv)" : "var(--muted-foreground)",
                }}
                aria-label={`Add ${scene.title ?? "scene"} to experience`}
              >
                {inAssembly ? <Check size={12} /> : <Plus size={12} />}
              </button>
            </div>
          );
        })}

        {scenes.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">No scenes available.</p>
        )}
      </div>
    </div>
  );
}

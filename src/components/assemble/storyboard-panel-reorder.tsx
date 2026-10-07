"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";

/**
 * StoryboardPanelReorder — reusable up/down reorder controls.
 *
 * Renders compact move-earlier / move-later buttons for a panel.
 * Calls onReorder with the new ordered panel_id array so the
 * workspace can POST action=reorder-panels.
 */
export function StoryboardPanelReorder({
  panels,
  panelId,
  onReorder,
}: {
  panels: StoryboardPanelRecord[];
  panelId: string;
  onReorder: (orderedIds: string[]) => void;
}) {
  const index = panels.findIndex((p) => p.panel_id === panelId);
  if (index < 0) return null;

  function move(direction: "up" | "down") {
    const ids = panels.map((p) => p.panel_id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ids.length) return;
    const next = [...ids];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    onReorder(next);
  }

  return (
    <div className="flex items-center gap-0.5" aria-label="Reorder panel">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={index === 0}
        className={cn(
          "w-5 h-5 flex items-center justify-center rounded text-muted-foreground transition-colors",
          index === 0 ? "opacity-20 cursor-not-allowed" : "hover:text-foreground hover:bg-muted/40"
        )}
        title="Move earlier"
        aria-label="Move panel earlier"
      >
        <ChevronUp size={11} />
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={index === panels.length - 1}
        className={cn(
          "w-5 h-5 flex items-center justify-center rounded text-muted-foreground transition-colors",
          index === panels.length - 1 ? "opacity-20 cursor-not-allowed" : "hover:text-foreground hover:bg-muted/40"
        )}
        title="Move later"
        aria-label="Move panel later"
      >
        <ChevronDown size={11} />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SuiteScene } from "@/lib/assemble/suite";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { formatTimelineMs } from "@/lib/media/timing";
import { ASSIST_ACTIONS } from "@/lib/storyboard/assist";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

export function StoryboardLeftColumn({
  script,
  hasPanels,
  saveState,
  scenes,
  universeId,
  inspectHref,
  onScriptChange,
  onSave,
  onGenerate,
  onAssist,
  onSelectScene,
}: {
  script: string;
  hasPanels: boolean;
  saveState: GenerationState;
  scenes: SuiteScene[];
  universeId: string | null;
  inspectHref?: string | null;
  onScriptChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  onAssist: (id: string) => void;
  onSelectScene: (id: string) => void;
}) {
  const [scriptOpen, setScriptOpen] = useState(!hasPanels);

  return (
    <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
      {/* Script */}
      <section aria-labelledby="work-context-script">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p id="work-context-script" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Script
          </p>
          {hasPanels && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setScriptOpen((v) => !v)}
            >
              {scriptOpen ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
        {scriptOpen && (
          <div className="space-y-2">
            <Textarea
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              className="min-h-[12rem] font-mono text-sm leading-relaxed resize-none"
              placeholder={"SCENE 1: EXT. CITY STREET — NIGHT\nThe detective walks the mural."}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" onClick={onGenerate}>
                Generate storyboard
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onSave}>
                Save
              </Button>
              {ASSIST_ACTIONS.slice(0, 3).map((item) => (
                <Button key={item.id} type="button" size="sm" variant="ghost" onClick={() => onAssist(item.id)}>
                  {item.label}
                </Button>
              ))}
            </div>
            {saveState.status !== "idle" && (
              <p className={cn("text-xs", saveState.status === "failed" || saveState.status === "unavailable" ? "text-destructive" : "text-muted-foreground")} data-generation-status={saveState.status}>
                {saveState.message}
              </p>
            )}
          </div>
        )}
        {!scriptOpen && script && (
          <p className="text-xs text-muted-foreground line-clamp-2 cursor-pointer" onClick={() => setScriptOpen(true)}>
            {script.slice(0, 120)}{script.length > 120 ? "…" : ""}
          </p>
        )}
      </section>

      {/* Canonical Scenes */}
      {scenes.length > 0 && (
        <section aria-labelledby="work-context-scenes">
          <p id="work-context-scenes" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Canonical Scenes
          </p>
          <ol className="space-y-2">
            {scenes.map((scene) => (
              <li key={scene.master_id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Canonical Scene</p>
                <p className="font-medium text-foreground leading-snug">
                  {sceneShortTitle(scene.title) ?? scene.title ?? "Untitled scene"}
                </p>
                {scene.start_ms != null && scene.end_ms != null && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {formatTimelineMs(scene.start_ms)}–{formatTimelineMs(scene.end_ms)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">Existing Universe scene</p>
                <div className="mt-1.5 flex gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onSelectScene(scene.master_id)}>
                    Select
                  </Button>
                  {inspectHref && universeId && (
                    <a href={inspectHref} className="inline-flex h-6 items-center rounded-md border border-border px-2 text-[10px] text-muted-foreground hover:text-foreground">
                      Open Scene
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

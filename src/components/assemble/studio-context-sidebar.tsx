"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";
import type { StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import type { SuiteScene } from "@/lib/assemble/suite";
import { StudioWorkbenchNav, type WorkbenchPanel } from "./studio-workbench-nav";

type JobLike = { panel_id: string | null; status: string; kind?: string };

export function StudioContextSidebar({
  universeTitle,
  workId,
  activePanel,
  mobileView,
  workTitle,
  persistedPanels,
  sentinelPanels,
  scenes,
  selectedId,
  panelStills,
  pendingPanels,
  jobs,
  onSelect,
  onCreatePanel,
}: {
  universeTitle?: string | null;
  workId: string | null;
  activePanel: WorkbenchPanel;
  mobileView: boolean;
  workTitle: string;
  persistedPanels: StoryboardPanelRecord[];
  sentinelPanels: StoryboardPanel[];
  scenes: SuiteScene[];
  selectedId: string | null;
  panelStills: Record<string, string>;
  pendingPanels: Record<string, boolean>;
  jobs: JobLike[];
  onSelect: (id: string) => void;
  onCreatePanel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const showScenes = persistedPanels.length === 0 && sentinelPanels.length === 0;

  return (
    <aside className={cn("studio-context-sidebar flex flex-col gap-3", expanded && "studio-context-sidebar-expanded")}>
      {workId ? <StudioWorkbenchNav workId={workId} active={activePanel} mobileView={mobileView} /> : null}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center h-6 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        title={expanded ? "Collapse panel list" : "Expand panel list"}
      >
        <span className="text-[9px] font-mono">{expanded ? "\u2190" : "\u2192"}</span>
      </button>

      {/* Panel list */}
      <div className="flex flex-col gap-1.5">
        {expanded && (
          <div className="flex items-center justify-between gap-1 px-1">
            <p className="suite-kicker">Panels</p>
            <Button type="button" size="sm" variant="ghost"
              className="h-5 suite-kicker normal-case tracking-normal font-normal px-1"
              onClick={onCreatePanel}>
              +
            </Button>
          </div>
        )}
        {!expanded && (
          <button type="button" onClick={onCreatePanel}
            className="w-full flex items-center justify-center h-6 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Add panel">
            <span className="text-base leading-none">+</span>
          </button>
        )}

        <ol className="flex flex-col gap-2">
          {persistedPanels.map((panel) => {
            const hasMotion = Boolean(panel.motion_playback_id);
            const isSelected = selectedId === panel.panel_id;
            const isPending = Boolean(pendingPanels[panel.panel_id]);
            const activeJob = jobs.find(
              (j) => j.panel_id === panel.panel_id &&
                (j.status === "queued" || j.status === "submitted" || j.status === "processing"),
            );
            const still = panelStills[panel.panel_id] ?? panel.still_url ?? null;

            return (
              <li key={panel.panel_id}>
                <button
                  type="button"
                  onClick={() => onSelect(panel.panel_id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "studio-panel-card",
                    isSelected && "studio-panel-card-selected",
                  )}
                >
                  <div className="relative w-full aspect-video bg-muted/40 rounded-t overflow-hidden">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                    {(isPending || activeJob) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <span className="text-[9px] text-muted-foreground animate-pulse">
                          {activeJob ? "…" : "…"}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1.5 font-mono text-[9px] text-white/70 leading-none">
                      {String(panel.sequence).padStart(2, "0")}
                    </span>
                    {hasMotion && (
                      <span className="absolute top-1 right-1.5 text-[9px] text-white/60">▶</span>
                    )}
                  </div>
                  {expanded && (
                    <div className="px-1.5 py-1">
                      <p className="text-xs truncate leading-snug text-foreground">
                        {panel.title || "Untitled panel"}
                      </p>
                      {panel.user_locked && (
                        <p className="suite-kicker">Authored</p>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}

          {sentinelPanels.map((panel, i) => {
            const isSelected = selectedId === panel.panel_id;
            const still = panelStills[panel.panel_id] ?? panel.still_url ?? null;
            return (
              <li key={panel.panel_id}>
                <button
                  type="button"
                  onClick={() => onSelect(panel.panel_id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn("studio-panel-card", isSelected && "studio-panel-card-selected")}
                >
                  <div className="relative w-full aspect-video bg-muted/40 rounded-t overflow-hidden">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                    <span className="absolute bottom-1 left-1.5 font-mono text-[9px] text-white/70 leading-none">
                      {String(persistedPanels.length + i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  {expanded && (
                    <div className="px-1.5 py-1">
                      <p className="text-xs truncate leading-snug text-foreground">{panel.title}</p>
                      <p className="suite-kicker">{panel.kind === "scene" ? "Scene" : "Evidence"}</p>
                    </div>
                  )}
                </button>
              </li>
            );
          })}

          {showScenes && scenes.map((scene, i) => {
            const isSelected = selectedId === scene.master_id;
            return (
              <li key={scene.master_id}>
                <button
                  type="button"
                  onClick={() => onSelect(scene.master_id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn("studio-panel-card", isSelected && "studio-panel-card-selected")}
                >
                  <div className="px-1.5 py-2">
                    {expanded ? (
                      <>
                        <p className="text-xs truncate leading-snug text-foreground">
                          {sceneShortTitle(scene.title) ?? scene.title ?? "Untitled scene"}
                        </p>
                        <p className="suite-kicker">
                          {String(i + 1).padStart(2, "0")}
                          {scene.start_ms != null && scene.end_ms != null && (
                            <> · {formatTimelineMs(scene.start_ms)}–{formatTimelineMs(scene.end_ms)}</>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="font-mono text-[9px] text-muted-foreground text-center">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";
import type { StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import type { SuiteScene } from "@/lib/assemble/suite";

type JobLike = { panel_id: string | null; status: string; kind?: string };

export function StudioContextSidebar({
  universeTitle,
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
  const showScenes = persistedPanels.length === 0 && sentinelPanels.length === 0;

  return (
    <aside className="studio-context-sidebar flex flex-col gap-4">
      {/* Identity */}
      <div className="px-1">
        {universeTitle && <p className="suite-kicker mb-0.5">Universe</p>}
        {universeTitle && (
          <p className="text-xs font-medium text-foreground leading-snug truncate">{universeTitle}</p>
        )}
        <p className="suite-kicker normal-case tracking-normal font-normal mt-1 truncate">
          {workTitle || "Untitled storyboard"}
        </p>
      </div>

      {/* Panel list */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="suite-kicker">Panels</p>
          <Button type="button" size="sm" variant="ghost"
            className="h-5 suite-kicker normal-case tracking-normal font-normal px-1.5"
            onClick={onCreatePanel}>
            + Add
          </Button>
        </div>

        {persistedPanels.length === 0 && sentinelPanels.length === 0 && scenes.length === 0 && (
          <p className="px-1 suite-kicker normal-case tracking-normal font-normal">
            No panels yet. Write a directive and generate.
          </p>
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
                          {activeJob ? "Generating…" : "…"}
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
                  <div className="px-1.5 py-1">
                    <p className="text-xs truncate leading-snug text-foreground">
                      {panel.title || "Untitled panel"}
                    </p>
                    {panel.user_locked && (
                      <p className="suite-kicker">Authored</p>
                    )}
                  </div>
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
                  <div className="px-1.5 py-1">
                    <p className="text-xs truncate leading-snug text-foreground">{panel.title}</p>
                    <p className="suite-kicker">{panel.kind === "scene" ? "Scene" : "Evidence"}</p>
                  </div>
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
                    <p className="text-xs truncate leading-snug text-foreground">
                      {sceneShortTitle(scene.title) ?? scene.title ?? "Untitled scene"}
                    </p>
                    <p className="suite-kicker">
                      {String(i + 1).padStart(2, "0")}
                      {scene.start_ms != null && scene.end_ms != null && (
                        <> · {formatTimelineMs(scene.start_ms)}–{formatTimelineMs(scene.end_ms)}</>
                      )}
                    </p>
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

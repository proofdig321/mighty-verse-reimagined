"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { derivePanelUiStatus } from "@/lib/storyboard/panel-state";
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
  const showScenes =
    persistedPanels.length === 0 && sentinelPanels.length === 0;

  return (
    <aside className="studio-context-sidebar flex flex-col gap-5 min-h-0 overflow-y-auto">
      {/* Identity */}
      <div className="px-1">
        {universeTitle && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
            Universe
          </p>
        )}
        {universeTitle && (
          <p className="text-sm font-medium text-foreground leading-snug truncate">
            {universeTitle}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {workTitle || "Untitled storyboard"}
        </p>
      </div>

      {/* Panel strip */}
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Panels
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={onCreatePanel}
          >
            + Add
          </Button>
        </div>

        {persistedPanels.length === 0 &&
          sentinelPanels.length === 0 &&
          scenes.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              No panels yet. Write a directive and generate, or import from
              Sentinel.
            </p>
          )}

        <ol className="flex flex-col gap-1.5">
          {persistedPanels.map((panel) => {
            const hasStill = Boolean(
              panelStills[panel.panel_id] ?? panel.still_url,
            );
            const hasMotion = Boolean(panel.motion_playback_id);
            const isSelected = selectedId === panel.panel_id;
            const isPending = Boolean(pendingPanels[panel.panel_id]);
            const activeJob = jobs.find(
              (j) =>
                j.panel_id === panel.panel_id &&
                (j.status === "queued" ||
                  j.status === "submitted" ||
                  j.status === "processing"),
            );
            const still =
              panelStills[panel.panel_id] ?? panel.still_url ?? null;

            return (
              <li key={panel.panel_id}>
                <button
                  type="button"
                  onClick={() => onSelect(panel.panel_id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "w-full text-left rounded-lg overflow-hidden border transition-colors",
                    isSelected
                      ? "border-primary/60 bg-accent"
                      : "border-border/50 bg-card/60 hover:border-border hover:bg-card",
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full bg-muted/30">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={still}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                    {(isPending || activeJob) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <span className="text-[10px] text-muted-foreground animate-pulse">
                          {activeJob ? "Generating…" : "…"}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1.5 font-mono text-[10px] text-white/70">
                      {String(panel.sequence).padStart(2, "0")}
                    </span>
                    {hasMotion && (
                      <span className="absolute top-1 right-1.5 text-[9px] text-white/60">
                        ▶
                      </span>
                    )}
                  </div>
                  {/* Meta */}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-foreground truncate leading-snug">
                      {panel.title || "Untitled panel"}
                    </p>
                    {panel.user_locked && (
                      <p className="text-[9px] text-muted-foreground">
                        Authored
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}

          {sentinelPanels.map((panel, i) => {
            const isSelected = selectedId === panel.panel_id;
            const still =
              panelStills[panel.panel_id] ?? panel.still_url ?? null;
            return (
              <li key={panel.panel_id}>
                <button
                  type="button"
                  onClick={() => onSelect(panel.panel_id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "w-full text-left rounded-lg overflow-hidden border transition-colors",
                    isSelected
                      ? "border-primary/60 bg-accent"
                      : "border-border/50 bg-card/60 hover:border-border hover:bg-card",
                  )}
                >
                  <div className="relative aspect-video w-full bg-muted/30">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={still}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                    <span className="absolute bottom-1 left-1.5 font-mono text-[10px] text-white/70">
                      {String(persistedPanels.length + i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    <p className="flex-1 text-xs text-foreground truncate">
                      {panel.title}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1 shrink-0"
                    >
                      {panel.kind === "scene" ? "Scene" : "Evidence"}
                    </Badge>
                  </div>
                </button>
              </li>
            );
          })}

          {showScenes &&
            scenes.map((scene, i) => {
              const isSelected = selectedId === scene.master_id;
              return (
                <li key={scene.master_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(scene.master_id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "w-full text-left rounded-lg overflow-hidden border px-2 py-2 transition-colors",
                      isSelected
                        ? "border-primary/60 bg-accent"
                        : "border-border/50 bg-card/60 hover:border-border hover:bg-card",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground w-5 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="flex-1 text-xs font-medium text-foreground truncate">
                        {sceneShortTitle(scene.title) ??
                          scene.title ??
                          "Untitled scene"}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1 shrink-0"
                      >
                        Scene
                      </Badge>
                    </div>
                    {scene.start_ms != null && scene.end_ms != null && (
                      <p className="mt-0.5 ml-7 font-mono text-[10px] text-muted-foreground">
                        {formatTimelineMs(scene.start_ms)}–
                        {formatTimelineMs(scene.end_ms)}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
        </ol>
      </div>
    </aside>
  );
}

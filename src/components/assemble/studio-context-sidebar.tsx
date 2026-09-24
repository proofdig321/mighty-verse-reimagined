"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
          <p className="suite-kicker mb-0.5">Universe</p>
        )}
        {universeTitle && (
          <p className="text-xs font-medium text-foreground leading-snug truncate">{universeTitle}</p>
        )}
        <p className="suite-kicker normal-case tracking-normal font-normal mt-1 truncate">
          {workTitle || "Untitled storyboard"}
        </p>
      </div>

      {/* Panel strip */}
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="suite-kicker">Panels</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 suite-kicker normal-case tracking-normal font-normal px-1.5"
            onClick={onCreatePanel}
          >
            + Add
          </Button>
        </div>

        {persistedPanels.length === 0 &&
          sentinelPanels.length === 0 &&
          scenes.length === 0 && (
            <p className="px-1 suite-kicker normal-case tracking-normal font-normal">
              No panels yet. Write a directive and generate, or import from Sentinel.
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
                    "w-full text-left rounded flex items-center gap-2 px-1.5 py-1 transition-colors",
                    isSelected
                      ? "bg-accent text-foreground"
                      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="relative w-10 h-7 shrink-0 rounded overflow-hidden bg-muted/40">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                    {(isPending || activeJob) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <span className="text-[9px] animate-pulse">…</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate leading-snug">
                      {panel.title || "Untitled panel"}
                    </p>
                    <p className="font-mono suite-kicker normal-case tracking-normal font-normal">
                      {String(panel.sequence).padStart(2, "0")}{hasMotion ? " ▶" : ""}{panel.user_locked ? " ·" : ""}
                    </p>
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
                    "w-full text-left rounded flex items-center gap-2 px-1.5 py-1 transition-colors",
                    isSelected
                      ? "bg-accent text-foreground"
                      : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="relative w-10 h-7 shrink-0 rounded overflow-hidden bg-muted/40">
                    {still ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={still} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 suite-still-placeholder" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate leading-snug">{panel.title}</p>
                    <p className="suite-kicker">{panel.kind === "scene" ? "Scene" : "Evidence"}</p>
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
                      "w-full text-left rounded flex items-center gap-2 px-1.5 py-1 transition-colors",
                      isSelected
                        ? "bg-accent text-foreground"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate leading-snug">
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

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { derivePanelUiStatus } from "@/lib/storyboard/panel-state";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";
import type { StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import type { SuiteScene } from "@/lib/assemble/suite";

type JobLike = { panel_id: string | null; status: string; kind?: string };

export function StoryboardCenterColumn({
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
  const empty = persistedPanels.length === 0 && sentinelPanels.length === 0 && scenes.length === 0;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Storyboard Outline
        </p>
        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={onCreatePanel}>
          + Panel
        </Button>
      </div>

      {empty ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Write a script and generate panels, or import from Sentinel.
        </p>
      ) : (
        <ol className="space-y-px overflow-y-auto">
          {persistedPanels.map((panel) => {
            const status = derivePanelUiStatus({
              selected: selectedId === panel.panel_id,
              persistedStatus: panel.status,
              stillUrl: panelStills[panel.panel_id] ?? panel.still_url,
              motionPlaybackId: panel.motion_playback_id,
              jobs: jobs.filter((j) => j.panel_id === panel.panel_id),
            });
            const hasStill = Boolean(panelStills[panel.panel_id] ?? panel.still_url);
            const hasMotion = Boolean(panel.motion_playback_id);
            const isSelected = selectedId === panel.panel_id;
            return (
              <OutlineRow
                key={panel.panel_id}
                seq={panel.sequence}
                title={panel.title}
                timing={panel.duration_ms ? formatTimelineMs(panel.duration_ms) : null}
                hasStill={hasStill}
                hasMotion={hasMotion}
                locked={panel.user_locked}
                pending={Boolean(pendingPanels[panel.panel_id])}
                selected={isSelected}
                status={status}
                onClick={() => onSelect(panel.panel_id)}
              />
            );
          })}

          {sentinelPanels.map((panel, i) => (
            <OutlineRow
              key={panel.panel_id}
              seq={persistedPanels.length + i + 1}
              title={panel.title}
              timing={panel.time_ms ? formatTimelineMs(panel.time_ms) : null}
              hasStill={Boolean(panelStills[panel.panel_id] ?? panel.still_url)}
              hasMotion={false}
              locked={false}
              pending={Boolean(pendingPanels[panel.panel_id])}
              selected={selectedId === panel.panel_id}
              badge={panel.kind === "scene" ? "Scene" : "Evidence"}
              onClick={() => onSelect(panel.panel_id)}
            />
          ))}

          {showScenes && scenes.map((scene, i) => (
            <OutlineRow
              key={scene.master_id}
              seq={i + 1}
              title={sceneShortTitle(scene.title) ?? scene.title ?? "Untitled"}
              timing={
                scene.start_ms != null && scene.end_ms != null
                  ? `${formatTimelineMs(scene.start_ms)}–${formatTimelineMs(scene.end_ms)}`
                  : null
              }
              hasStill={Boolean(panelStills[scene.master_id])}
              hasMotion={false}
              locked={false}
              pending={Boolean(pendingPanels[scene.master_id])}
              selected={selectedId === scene.master_id}
              badge="Scene"
              onClick={() => onSelect(scene.master_id)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function OutlineRow({
  seq,
  title,
  timing,
  hasStill,
  hasMotion,
  locked,
  pending,
  selected,
  badge,
  status,
  onClick,
}: {
  seq: number;
  title: string;
  timing: string | null;
  hasStill: boolean;
  hasMotion: boolean;
  locked: boolean;
  pending: boolean;
  selected: boolean;
  badge?: string;
  status?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-2 py-1.5 rounded text-left text-sm transition-colors",
          selected
            ? "bg-accent text-accent-foreground"
            : "hover:bg-muted/50 text-foreground",
        )}
        aria-current={selected ? "true" : undefined}
      >
        <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground text-right">
          {String(seq).padStart(2, "0")}
        </span>
        <span className="flex-1 min-w-0 truncate">{title}</span>
        <span className="flex items-center gap-1 shrink-0">
          {badge && (
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{badge}</span>
          )}
          {locked && <span className="text-[9px] text-muted-foreground" title="Authored">●</span>}
          {hasStill && <span className="text-[9px] text-muted-foreground" title="Still">▪</span>}
          {hasMotion && <span className="text-[9px] text-muted-foreground" title="Motion">▶</span>}
          {pending && <span className="text-[9px] text-muted-foreground animate-pulse">…</span>}
        </span>
        {timing && (
          <span className="font-mono text-[10px] text-muted-foreground shrink-0 hidden sm:block">
            {timing}
          </span>
        )}
      </button>
    </li>
  );
}

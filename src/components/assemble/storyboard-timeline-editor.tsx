"use client";

import { useRef, useState } from "react";
import { ZoomIn, ZoomOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/media/timing";
import { PlayerControls } from "@/components/player/player-controls";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { TimelinePlayhead } from "./timeline-playhead";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { useTimelineEditor } from "./use-timeline-editor";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";

const PX_PER_MS_BASE = 0.04; // 40px per second at zoom=1
const TRACK_HEIGHT = 72; // px per track row
const LABEL_WIDTH = 72; // px for track label column

export function StoryboardTimelineEditor({
  panels,
  onSaveDurations,
}: {
  panels: StoryboardPanelRecord[];
  onSaveDurations: (durations: Record<string, number>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);

  const tl = useTimelineEditor({
    panels,
    onSaveDurations: (d) => { onSaveDurations(d); setDirty(false); },
  });

  const pxPerMs = PX_PER_MS_BASE * tl.zoom;
  const totalTrackHeight = TRACK_HEIGHT * 2 + 4; // video + audio tracks

  const activeClip = tl.clips.find((c) => c.panel_id === tl.activeClipId) ?? null;
  const selectedClip = tl.clips.find((c) => c.panel_id === tl.selectedClipId) ?? null;

  // Markers for PlayerControls — one per clip start
  const markers = tl.clips.map((c) => ({
    id: c.panel_id,
    positionMs: tl.clipStartMs(c.panel_id),
    label: c.title,
  }));

  // Audio track is a placeholder — no audio assets yet
  const audioClips = tl.clips.filter((c) => false as boolean); // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion

  function handleLaneClick(e: React.MouseEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left + e.currentTarget.scrollLeft;
    tl.seekTo(x / pxPerMs);
  }

  if (panels.length === 0) {
    return (
      <div className="timeline-editor-empty">
        <p className="text-sm text-muted-foreground">Add panels to the storyboard to use the timeline editor.</p>
      </div>
    );
  }

  return (
    <div className="timeline-editor" ref={containerRef}>
      {/* Header row */}
      <div className="timeline-editor-header">
        <div className="timeline-editor-header-left">
          <span className="suite-kicker">Timeline</span>
          <span className="timeline-editor-duration">{formatMs(tl.totalDurationMs)}</span>
          {dirty && <span className="timeline-editor-unsaved">Unsaved</span>}
        </div>
        <div className="timeline-editor-header-right">
          <button type="button" className="timeline-zoom-btn" onClick={() => tl.setZoom((z) => Math.max(0.25, z / 1.5))} aria-label="Zoom out">
            <ZoomOut size={13} />
          </button>
          <button type="button" className="timeline-zoom-btn" onClick={() => tl.setZoom((z) => Math.min(8, z * 1.5))} aria-label="Zoom in">
            <ZoomIn size={13} />
          </button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
            onClick={() => { tl.saveDurations(); setDirty(false); }}>
            <Save size={11} /> Save durations
          </Button>
        </div>
      </div>

      {/* Transport / PlayerControls */}
      <PlayerControls
        currentMs={tl.playheadMs}
        durationMs={tl.totalDurationMs}
        playing={tl.playing}
        muted={tl.muted}
        volume={tl.volume}
        markers={markers}
        contextLabel={activeClip?.title ?? null}
        variant="timeline"
        showSkip
        showFullscreen={false}
        showVolume
        onTogglePlay={tl.togglePlay}
        onRestart={tl.restart}
        onSeek={tl.seekTo}
        onMuteToggle={() => tl.setMuted((m) => !m)}
        onVolumeChange={(v) => { tl.setVolume(v); tl.setMuted(v === 0); }}
        onSkipPrev={() => {
          const idx = tl.clips.findIndex((c) => c.panel_id === tl.activeClipId);
          if (idx > 0) tl.seekToClip(tl.clips[idx - 1].panel_id);
        }}
        onSkipNext={() => {
          const idx = tl.clips.findIndex((c) => c.panel_id === tl.activeClipId);
          if (idx < tl.clips.length - 1) tl.seekToClip(tl.clips[idx + 1].panel_id);
        }}
      />

      {/* Timeline canvas */}
      <div className="timeline-canvas">
        {/* Track labels column */}
        <div className="timeline-labels" style={{ width: LABEL_WIDTH }}>
          <div className="timeline-ruler-spacer" />
          <div className="timeline-label-row" style={{ height: TRACK_HEIGHT }}>
            <span className="timeline-label-text">Video</span>
          </div>
          <div className="timeline-label-row" style={{ height: TRACK_HEIGHT }}>
            <span className="timeline-label-text">Audio</span>
          </div>
        </div>

        {/* Scrollable lane */}
        <div className="timeline-lane-scroll" ref={laneRef}>
          {/* Ruler */}
          <div className="timeline-ruler-row" onClick={handleLaneClick}>
            <TimelineRuler totalMs={tl.totalDurationMs} pxPerMs={pxPerMs} />
          </div>

          {/* Tracks + playhead */}
          <div className="timeline-tracks-area" style={{ position: "relative", height: totalTrackHeight }}>
            {/* Video track */}
            <TimelineTrack
              label="Video"
              kind="video"
              clips={tl.clips}
              pxPerMs={pxPerMs}
              selectedClipId={tl.selectedClipId}
              activeClipId={tl.activeClipId}
              totalMs={tl.totalDurationMs}
              onSelectClip={(id) => { tl.setSelectedClipId(id); tl.seekToClip(id); }}
              onClipDurationChange={(id, ms) => { tl.setClipDuration(id, ms); setDirty(true); }}
              onReorder={(from, to) => { tl.reorderClips(from, to); setDirty(true); }}
            />

            {/* Audio track — placeholder */}
            <TimelineTrack
              label="Audio"
              kind="audio"
              clips={audioClips}
              pxPerMs={pxPerMs}
              selectedClipId={null}
              activeClipId={null}
              totalMs={tl.totalDurationMs}
              onSelectClip={() => {}}
              onClipDurationChange={() => {}}
              onReorder={() => {}}
            >
              <span className="text-[10px] text-muted-foreground/40">Music / audio — coming soon</span>
            </TimelineTrack>

            {/* Playhead */}
            <TimelinePlayhead
              positionMs={tl.playheadMs}
              totalMs={tl.totalDurationMs}
              pxPerMs={pxPerMs}
              trackHeight={totalTrackHeight}
              onSeek={tl.seekTo}
            />
          </div>
        </div>
      </div>

      {/* Inspector — selected clip details + preview */}
      {selectedClip && (
        <div className="timeline-inspector">
          <div className="timeline-inspector-meta">
            <p className="suite-kicker mb-1">Panel {String(selectedClip.sequence).padStart(2, "0")}</p>
            <p className="text-sm font-medium">{selectedClip.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <label className="suite-kicker">Duration</label>
              <input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={(selectedClip.duration_ms / 1000).toFixed(1)}
                className="timeline-duration-input"
                aria-label="Clip duration in seconds"
                onChange={(e) => {
                  tl.setClipDuration(selectedClip.panel_id, Number(e.target.value) * 1000);
                  setDirty(true);
                }}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
          {selectedClip.motion_endpoint ? (
            <div className="timeline-inspector-preview">
              <StoryboardHlsPreview
                endpoint={selectedClip.motion_endpoint}
                poster={selectedClip.still_url}
                label={selectedClip.title}
              />
            </div>
          ) : selectedClip.still_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedClip.still_url} alt={selectedClip.title}
              className="timeline-inspector-still" />
          ) : null}
        </div>
      )}
    </div>
  );
}

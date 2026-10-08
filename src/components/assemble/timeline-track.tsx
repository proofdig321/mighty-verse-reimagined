"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { TimelineClip } from "./timeline-clip";
import type { TimelineClipItem } from "./use-timeline-editor";

export type TimelineTrackKind = "video" | "audio";

export function TimelineTrack({
  label,
  kind,
  clips,
  pxPerMs,
  selectedClipId,
  activeClipId,
  totalMs,
  onSelectClip,
  onClipDurationChange,
  onReorder,
  children,
}: {
  label: string;
  kind: TimelineTrackKind;
  clips: TimelineClipItem[];
  pxPerMs: number;
  selectedClipId: string | null;
  activeClipId: string | null;
  totalMs: number;
  onSelectClip: (id: string) => void;
  onClipDurationChange: (id: string, ms: number) => void;
  onReorder: (fromId: string, toId: string) => void;
  /** Optional placeholder content when track is empty */
  children?: React.ReactNode;
}) {
  const dragId = useRef<string | null>(null);

  return (
    <div className={cn("timeline-track", `timeline-track-${kind}`)}>
      {/* Track label */}
      <div className="timeline-track-label">
        <span className="timeline-track-name">{label}</span>
      </div>

      {/* Clip lane */}
      <div className="timeline-track-lane" style={{ width: Math.max(totalMs * pxPerMs, 200) }}>
        {clips.length === 0 ? (
          <div className="timeline-track-empty">{children ?? "No clips"}</div>
        ) : (
          clips.map((clip) => (
            <TimelineClip
              key={clip.panel_id}
              clip={clip}
              pxPerMs={pxPerMs}
              isSelected={selectedClipId === clip.panel_id}
              isActive={activeClipId === clip.panel_id}
              onSelect={() => onSelectClip(clip.panel_id)}
              onDurationChange={(ms) => onClipDurationChange(clip.panel_id, ms)}
              onDragStart={() => { dragId.current = clip.panel_id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current && dragId.current !== clip.panel_id) {
                  onReorder(dragId.current, clip.panel_id);
                }
                dragId.current = null;
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

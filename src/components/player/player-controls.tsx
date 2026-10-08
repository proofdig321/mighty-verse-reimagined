"use client";

import { Maximize2, Volume2, VolumeX, Play, Pause, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlayerControlsVariant = "holographic" | "spatial" | "timeline" | "minimal";

export type PlayerControlsProps = {
  /** Current playback position in ms */
  currentMs: number;
  /** Total duration in ms */
  durationMs: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  /** Scene/chapter markers on the progress bar */
  markers?: { id: string; positionMs: number; label: string }[];
  /** Label shown in the centre of the transport (e.g. current scene title) */
  contextLabel?: string | null;
  variant?: PlayerControlsVariant;
  /** Show skip prev/next buttons */
  showSkip?: boolean;
  /** Show fullscreen button */
  showFullscreen?: boolean;
  /** Show volume slider */
  showVolume?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (ms: number) => void;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onSkipPrev?: () => void;
  onSkipNext?: () => void;
  className?: string;
};

function formatClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PlayerControls({
  currentMs,
  durationMs,
  playing,
  muted,
  volume,
  markers = [],
  contextLabel,
  variant = "holographic",
  showSkip = false,
  showFullscreen = true,
  showVolume = true,
  containerRef,
  onTogglePlay,
  onRestart,
  onSeek,
  onMuteToggle,
  onVolumeChange,
  onSkipPrev,
  onSkipNext,
  className,
}: PlayerControlsProps) {
  const progress = durationMs > 0 ? Math.min(1, currentMs / durationMs) : 0;

  function seekFromClick(clientX: number, el: HTMLDivElement) {
    const bounds = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    onSeek(Math.round(ratio * durationMs));
  }

  const isTimeline = variant === "timeline";
  const isMinimal = variant === "minimal";

  return (
    <div className={cn("player-controls", `player-controls-${variant}`, className)}>
      {/* Play / Pause */}
      <button
        type="button"
        className={cn("player-controls-play", isTimeline && "player-controls-play-timeline")}
        aria-pressed={playing}
        aria-label={playing ? "Pause" : "Play"}
        onClick={onTogglePlay}
      >
        {playing ? <Pause size={isTimeline ? 14 : 16} /> : <Play size={isTimeline ? 14 : 16} className="ml-0.5" />}
      </button>

      {/* Restart */}
      {!isMinimal && (
        <button type="button" className="player-controls-restart" aria-label="Restart" onClick={onRestart}>
          <RotateCcw size={12} />
        </button>
      )}

      {/* Skip prev */}
      {showSkip && onSkipPrev && (
        <button type="button" className="player-controls-skip" aria-label="Previous" onClick={onSkipPrev}>
          <SkipBack size={14} />
        </button>
      )}

      {/* Time */}
      <span className="player-controls-time">
        {formatClock(currentMs)}
        {!isMinimal && <span className="player-controls-time-sep"> / {formatClock(durationMs)}</span>}
      </span>

      {/* Progress bar */}
      <div
        className="player-controls-progress"
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs)}
        aria-valuenow={Math.round(currentMs)}
        aria-label="Seek"
        onClick={(e) => seekFromClick(e.clientX, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.max(0, currentMs - 5000)); }
          if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(durationMs, currentMs + 5000)); }
        }}
      >
        <span className="player-controls-progress-fill" style={{ width: `${progress * 100}%` }} />
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            className="player-controls-marker"
            style={{ left: `${durationMs > 0 ? (m.positionMs / durationMs) * 100 : 0}%` }}
            title={m.label}
            onClick={(e) => { e.stopPropagation(); onSeek(m.positionMs); }}
            aria-label={`Jump to ${m.label}`}
          />
        ))}
      </div>

      {/* Context label */}
      {contextLabel && !isMinimal && (
        <span className="player-controls-context">{contextLabel}</span>
      )}

      {/* Skip next */}
      {showSkip && onSkipNext && (
        <button type="button" className="player-controls-skip" aria-label="Next" onClick={onSkipNext}>
          <SkipForward size={14} />
        </button>
      )}

      {/* Volume */}
      {showVolume && (
        <label className="player-controls-volume">
          <span className="sr-only">Volume</span>
          <button
            type="button"
            className="player-controls-mute"
            aria-pressed={!muted && volume > 0}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            onClick={onMuteToggle}
          >
            {muted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          {!isMinimal && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume level"
              className="player-controls-volume-slider"
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
          )}
        </label>
      )}

      {/* Fullscreen */}
      {showFullscreen && containerRef && (
        <button
          type="button"
          className="player-controls-fullscreen"
          aria-label="Fullscreen"
          onClick={() => void containerRef.current?.requestFullscreen?.()}
        >
          <Maximize2 size={13} />
        </button>
      )}
    </div>
  );
}

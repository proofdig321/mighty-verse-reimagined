"use client";

import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { formatTimelineMs } from "@/lib/media/timing";
import {
  activeWindow,
  audienceLabel,
  formatClock,
  layerIsActive,
  layerKicker,
  stillAtTime,
  type HolographicProgram,
} from "@/lib/experience/holographic-program";
import { cn } from "@/lib/utils";
import { HolographicLayerMedia } from "./holographic-layer-media";

export function HolographicStage({
  program,
  compact = false,
  mode = "public",
}: {
  program: HolographicProgram;
  compact?: boolean;
  mode?: "public" | "studio";
}) {
  const stageId = useId();
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(!program.clock);
  const [timeMs, setTimeMs] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const durationMs = program.duration_ms || 1;
  const current = activeWindow(program.windows, timeMs);
  const progress = Math.min(1, timeMs / durationMs);

  useEffect(() => {
    if (!playing || program.clock) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = performance.now() - started;
      if (next >= durationMs) {
        setTimeMs(durationMs);
        setPlaying(false);
        return;
      }
      setTimeMs(next);
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, program.clock, durationMs, restartKey]);

  const liveStills = useMemo(() => {
    if (!playing || !program.clock?.thumbnail_ref) return null;
    return program.clock.thumbnail_ref;
  }, [playing, program.clock?.thumbnail_ref]);

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
    event.currentTarget.style.setProperty("--hx", `${x}deg`);
    event.currentTarget.style.setProperty("--hy", `${y}deg`);
  }

  function onLeave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--hx", "0deg");
    event.currentTarget.style.setProperty("--hy", "0deg");
  }

  function restart() {
    setTimeMs(0);
    setPlaying(false);
    setRestartKey((value) => value + 1);
  }

  function toggle() {
    if (timeMs >= durationMs) {
      setTimeMs(0);
      setRestartKey((value) => value + 1);
    }
    setPlaying((value) => !value);
  }

  return (
    <div
      className={cn("holographic-stage", compact && "holographic-stage-compact")}
      aria-labelledby={stageId}
      data-holographic-playing={playing ? "true" : "false"}
      data-holographic-mode={mode}
      data-holographic-active-scene={current?.scene_master_id ?? ""}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <p id={stageId} className="sr-only">
        Experience stage for {program.title}
      </p>

      <div className="holographic-transport">
        <button
          type="button"
          className="holographic-transport-play"
          aria-pressed={playing}
          onClick={toggle}
        >
          {playing ? "Pause" : ready || !program.clock ? "Play" : "Load"}
        </button>
        <button type="button" className="holographic-transport-restart" onClick={restart}>
          Restart
        </button>
        <p className="holographic-transport-time">
          {formatClock(timeMs)} / {formatClock(durationMs)}
        </p>
        <p className="holographic-transport-scene">
          {current ? audienceLabel(current.title, "Scene") : playing ? "Opening" : "Ready"}
        </p>
        <div
          className="holographic-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs)}
          aria-valuenow={Math.round(timeMs)}
          aria-label="Experience progress"
        >
          <span style={{ width: `${progress * 100}%` }} />
          {program.windows.map((window) => (
            <i
              key={window.scene_master_id}
              className="holographic-progress-mark"
              style={{ left: `${(window.start_ms / durationMs) * 100}%` }}
              title={window.title}
            />
          ))}
        </div>
      </div>

      <div className="holographic-space" aria-hidden={false}>
        {program.layers.map((layer) => {
          const active = layerIsActive(layer, timeMs);
          const title = audienceLabel(layer.title, layerKicker(layer.kind, mode));
          const still =
            liveStills && active && (layer.kind === "scene" || layer.kind === "moment")
              ? stillAtTime(liveStills, timeMs) ?? layer.still_url
              : layer.still_url;
          const showProductionVideo = layer.kind === "production" && Boolean(layer.playback_endpoint) && active;
          const showMuralVideo = layer.kind === "mural" && Boolean(program.clock);
          return (
            <article
              key={`${layer.layer_id}-${layer.kind === "mural" ? restartKey : 0}`}
              className={cn(
                "holographic-layer",
                `holographic-layer-${layer.kind}`,
                active && "holographic-layer-active",
                !active && "holographic-layer-inactive",
              )}
              data-holographic-kind={layer.kind}
              data-master-id={layer.master_id}
              data-layer-active={active ? "true" : "false"}
              data-production-layer={layer.kind === "production" ? "true" : undefined}
              style={{
                transform: `translate(-50%, -50%) translate3d(${layer.offset_x}px, ${layer.offset_y}px, ${layer.depth}px)`,
              }}
            >
              {showMuralVideo && program.clock ? (
                <HolographicLayerMedia
                  key={restartKey}
                  clock={{
                    endpoint_ref: program.clock.endpoint_ref,
                    projection_id: program.clock.projection_id,
                    master_id: program.clock.master_id,
                    canonical_state_id: program.clock.canonical_state_id,
                    start_ms: 0,
                    end_ms: program.duration_ms || null,
                  }}
                  posterUrl={layer.still_url}
                  title={title}
                  playing={playing}
                  muted={mode === "studio"}
                  onTimeMs={setTimeMs}
                  onReady={() => setReady(true)}
                  onEnded={() => {
                    setPlaying(false);
                    setTimeMs(program.duration_ms);
                  }}
                />
              ) : showProductionVideo && layer.playback_endpoint ? (
                <HolographicLayerMedia
                  clock={{
                    endpoint_ref: layer.playback_endpoint,
                    start_ms: 0,
                    end_ms: null,
                  }}
                  posterUrl={layer.still_url}
                  title={title}
                  playing={playing && active}
                  muted
                  loop
                />
              ) : still ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={still} alt="" />
              ) : (
                <div className="holographic-placeholder" />
              )}
              <p className="holographic-kicker">{layerKicker(layer.kind, mode)}</p>
              <p className="holographic-title">{title}</p>
              {mode === "studio" && layer.start_ms != null && layer.end_ms != null && layer.kind === "scene" ? (
                <p className="holographic-window">{`${formatTimelineMs(layer.start_ms)} → ${formatTimelineMs(layer.end_ms)}`}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export type { HolographicLayer };

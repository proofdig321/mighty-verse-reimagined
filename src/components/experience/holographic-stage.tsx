"use client";

import { useEffect, useId, useState, type PointerEvent, type ReactNode } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { formatTimelineMs } from "@/lib/media/timing";
import {
  activeWindow,
  audienceLayerTitle,
  formatClock,
  layerIsActive,
  layerKicker,
  type HolographicProgram,
} from "@/lib/experience/holographic-program";
import { cn } from "@/lib/utils";
import { HolographicLayerMedia } from "./holographic-layer-media";

function LayerCard({
  layer,
  active,
  title,
  mode,
  children,
}: {
  layer: HolographicLayer;
  active: boolean;
  title: string;
  mode: "public" | "studio";
  children: ReactNode;
}) {
  return (
    <article
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
    >
      {children}
      <p className="holographic-kicker">{layerKicker(layer.kind, mode)}</p>
      <p className="holographic-title">{title}</p>
      {mode === "studio" && layer.start_ms != null && layer.end_ms != null && layer.kind === "scene" ? (
        <p className="holographic-window">{`${formatTimelineMs(layer.start_ms)} → ${formatTimelineMs(layer.end_ms)}`}</p>
      ) : null}
    </article>
  );
}

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
  const [seekNonce, setSeekNonce] = useState(0);
  const durationMs = program.duration_ms || 1;
  const current = activeWindow(program.windows, timeMs);
  const progress = Math.min(1, timeMs / durationMs);
  const mural = program.layers.find((layer) => layer.kind === "mural") ?? null;
  const scenes = program.layers.filter((layer) => layer.kind === "scene");
  const moments = program.layers.filter((layer) => layer.kind === "moment");
  const productions = program.layers.filter((layer) => layer.kind === "production");

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
  }, [playing, program.clock, durationMs, seekNonce]);

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -6;
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
    setSeekNonce((value) => value + 1);
  }

  function toggle() {
    if (timeMs >= durationMs) {
      setTimeMs(0);
      setSeekNonce((value) => value + 1);
    }
    setPlaying((value) => !value);
  }

  function layerTitle(layer: HolographicLayer) {
    return audienceLayerTitle(layer.title, layerKicker(layer.kind, mode));
  }

  function stillSurface(layer: HolographicLayer, title: string) {
    if (layer.still_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.still_url} alt="" />
      );
    }
    return <div className="holographic-placeholder" aria-hidden="true" title={title} />;
  }

  return (
    <div
      className={cn("holographic-stage", compact && "holographic-stage-compact")}
      aria-labelledby={stageId}
      data-holographic-playing={playing ? "true" : "false"}
      data-holographic-ready={ready ? "true" : "false"}
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
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="holographic-transport-restart" onClick={restart}>
          Restart
        </button>
        <p className="holographic-transport-time">
          {formatClock(timeMs)} / {formatClock(durationMs)}
        </p>
        <p className="holographic-transport-scene">
          {current ? audienceLayerTitle(current.title, "Scene") : playing ? "Opening" : "Ready"}
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
        {mural ? (
          <div className="holographic-cinema" data-holographic-cinema="">
            <LayerCard layer={mural} active title={layerTitle(mural)} mode={mode}>
              {program.clock ? (
                <HolographicLayerMedia
                  clock={{
                    endpoint_ref: program.clock.endpoint_ref,
                    projection_id: program.clock.projection_id,
                    master_id: program.clock.master_id,
                    canonical_state_id: program.clock.canonical_state_id,
                    start_ms: 0,
                    end_ms: program.duration_ms || null,
                  }}
                  posterUrl={mural.still_url}
                  title={layerTitle(mural)}
                  playing={playing}
                  muted={mode === "studio"}
                  seekNonce={seekNonce}
                  onTimeMs={setTimeMs}
                  onReady={() => setReady(true)}
                  onEnded={() => {
                    setPlaying(false);
                    setTimeMs(program.duration_ms);
                  }}
                />
              ) : (
                stillSurface(mural, layerTitle(mural))
              )}
            </LayerCard>
          </div>
        ) : null}

        {scenes.length > 0 ? (
          <div className="holographic-orbit holographic-orbit-scenes" data-holographic-orbit="scenes">
            {scenes.map((layer) => {
              const active = layerIsActive(layer, timeMs);
              const title = layerTitle(layer);
              return (
                <LayerCard key={layer.layer_id} layer={layer} active={active} title={title} mode={mode}>
                  {stillSurface(layer, title)}
                </LayerCard>
              );
            })}
          </div>
        ) : null}

        {moments.length > 0 ? (
          <div className="holographic-orbit holographic-orbit-moments" data-holographic-orbit="moments">
            {moments.map((layer) => {
              const active = layerIsActive(layer, timeMs);
              const title = layerTitle(layer);
              return (
                <LayerCard key={layer.layer_id} layer={layer} active={active} title={title} mode={mode}>
                  {stillSurface(layer, title)}
                </LayerCard>
              );
            })}
          </div>
        ) : null}

        {productions.length > 0 ? (
          <div className="holographic-orbit holographic-orbit-production" data-holographic-orbit="production">
            {productions.map((layer) => {
              const active = layerIsActive(layer, timeMs);
              const title = layerTitle(layer);
              const playVideo = Boolean(layer.playback_endpoint) && active;
              return (
                <LayerCard key={layer.layer_id} layer={layer} active={active} title={title} mode={mode}>
                  {playVideo && layer.playback_endpoint ? (
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
                      seekNonce={seekNonce}
                    />
                  ) : (
                    stillSurface(layer, title)
                  )}
                </LayerCard>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type { HolographicLayer };

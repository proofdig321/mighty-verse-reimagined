"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { Maximize2, Volume2, VolumeX } from "lucide-react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneOrdinal, sceneShortTitle } from "@/lib/assemble/composition";
import {
  activeWindow,
  audienceLayerTitle,
  formatClock,
  formatWindowRange,
  layerIsActive,
  layerKicker,
  type ExperienceSurfaceLinks,
  type HolographicProgram,
} from "@/lib/experience/holographic-program";
import { cn } from "@/lib/utils";
import { HolographicLayerMedia } from "./holographic-layer-media";

function LayerCard({
  layer,
  active,
  title,
  mode,
  interactive,
  chrome = true,
  onSelect,
  children,
}: {
  layer: HolographicLayer;
  active: boolean;
  title: string;
  mode: "public" | "studio";
  interactive?: boolean;
  chrome?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "holographic-layer",
    `holographic-layer-${layer.kind}`,
    active && "holographic-layer-active",
    !active && "holographic-layer-inactive",
  );
  const body = (
    <>
      {children}
      {chrome ? (
        <>
          <p className="holographic-kicker">{layerKicker(layer.kind, mode)}</p>
          <p className="holographic-title">{title}</p>
          {layer.start_ms != null && layer.end_ms != null && layer.kind === "scene" ? (
            <p className="holographic-window">{`${formatTimelineMs(layer.start_ms)} → ${formatTimelineMs(layer.end_ms)}`}</p>
          ) : null}
        </>
      ) : null}
    </>
  );
  if (interactive && onSelect) {
    return (
      <button
        type="button"
        className={className}
        data-holographic-kind={layer.kind}
        data-master-id={layer.master_id}
        data-layer-active={active ? "true" : "false"}
        data-production-layer={layer.kind === "production" ? "true" : undefined}
        onClick={onSelect}
      >
        {body}
      </button>
    );
  }
  return (
    <article
      className={className}
      data-holographic-kind={layer.kind}
      data-master-id={layer.master_id}
      data-layer-active={active ? "true" : "false"}
      data-production-layer={layer.kind === "production" ? "true" : undefined}
    >
      {body}
    </article>
  );
}

export function HolographicStage({
  program,
  compact = false,
  mode = "public",
  showCinema = true,
  showComposition = true,
  links,
  onSelectScene,
}: {
  program: HolographicProgram;
  compact?: boolean;
  mode?: "public" | "studio";
  showCinema?: boolean;
  showComposition?: boolean;
  links?: ExperienceSurfaceLinks | null;
  onSelectScene?: (sceneMasterId: string, startMs: number) => void;
}) {
  const cinemaRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(!program.clock);
  const [failed, setFailed] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [seekNonce, setSeekNonce] = useState(0);
  const [seekToMs, setSeekToMs] = useState<number | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const durationMs = program.duration_ms || 1;
  const current = activeWindow(program.windows, timeMs);
  const progress = Math.min(1, timeMs / durationMs);
  const mural = program.layers.find((layer) => layer.kind === "mural") ?? null;
  const scenes = program.layers.filter((layer) => layer.kind === "scene");
  const moments = program.layers.filter((layer) => layer.kind === "moment");
  const productions = program.layers.filter((layer) => layer.kind === "production");
  const activeScene = scenes.find((layer) => layerIsActive(layer, timeMs)) ?? null;

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
    setSeekToMs(0);
    setPlaying(false);
    setSeekNonce((value) => value + 1);
  }

  function toggle() {
    if (timeMs >= durationMs) {
      setTimeMs(0);
      setSeekToMs(0);
      setSeekNonce((value) => value + 1);
    }
    if (!playing && mode === "public") setMuted(false);
    setPlaying((value) => !value);
  }

  function seekTo(ms: number) {
    const next = Math.max(0, Math.min(durationMs, ms));
    setTimeMs(next);
    setSeekToMs(next);
  }

  function seekScene(layer: HolographicLayer) {
    if (layer.start_ms == null) return;
    seekTo(layer.start_ms);
    if (mode === "public") setMuted(false);
    setPlaying(true);
    onSelectScene?.(layer.master_id, layer.start_ms);
  }

  function seekFromProgress(clientX: number, element: HTMLElement) {
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    seekTo(ratio * durationMs);
  }

  function onTransportKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === " " || event.key === "k") {
      event.preventDefault();
      toggle();
    } else if (event.key === "m") {
      event.preventDefault();
      setMuted((value) => !value);
    } else if (event.key === "f") {
      event.preventDefault();
      void cinemaRef.current?.requestFullscreen?.();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(timeMs + 5000);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekTo(timeMs - 5000);
    } else if (event.key === "Home") {
      event.preventDefault();
      restart();
    }
  }

  function layerTitle(layer: HolographicLayer) {
    return audienceLayerTitle(layer.title, layerKicker(layer.kind, mode));
  }

  function stillSurface(layer: HolographicLayer, title: string, className?: string) {
    if (layer.still_url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.still_url} alt="" className={className} />
      );
    }
    return <div className={className || "holographic-placeholder"} aria-hidden="true" title={title} />;
  }

  function relatedMomentTitles(sceneId: string) {
    return moments
      .filter((moment) => moment.related_scene_ids.includes(sceneId))
      .map((moment) => audienceLayerTitle(moment.title, "Creative Moment"));
  }

  function relatedSceneTitles(moment: HolographicLayer) {
    return moment.related_scene_ids
      .map((id) => scenes.find((scene) => scene.master_id === id))
      .filter((scene): scene is HolographicLayer => Boolean(scene))
      .map((scene) => sceneShortTitle(scene.title) ?? audienceLayerTitle(scene.title, "Scene"));
  }

  return (
    <div
      className={cn("holographic-stage", compact && "holographic-stage-compact")}
      aria-label={`Experience stage for ${program.title}`}
      data-holographic-playing={playing ? "true" : "false"}
      data-holographic-ready={ready ? "true" : "false"}
      data-holographic-muted={muted ? "true" : "false"}
      data-holographic-mode={mode}
      data-holographic-active-scene={current?.scene_master_id ?? ""}
      onKeyDown={onTransportKey}
    >
      {showCinema ? (
        <>
          <div
            className="holographic-cinema"
            data-holographic-cinema=""
            ref={cinemaRef}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
          >
            {mural ? (
              <LayerCard layer={mural} active title={layerTitle(mural)} mode={mode} chrome={false}>
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
                    muted={muted}
                    volume={volume}
                    seekNonce={seekNonce}
                    seekToMs={seekToMs}
                    onTimeMs={setTimeMs}
                    onReady={() => {
                      setReady(true);
                      setFailed(false);
                    }}
                    onError={() => setFailed(true)}
                    onPlayingChange={setPlaying}
                    onEnded={() => {
                      setPlaying(false);
                      setTimeMs(program.duration_ms);
                    }}
                  />
                ) : (
                  stillSurface(mural, layerTitle(mural))
                )}
              </LayerCard>
            ) : null}

            {activeScene?.still_url ? (
              <div className="holographic-depth" aria-hidden="true">
                <div className="holographic-depth-plane">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeScene.still_url} alt="" />
                  <p>{sceneShortTitle(activeScene.title) ?? layerTitle(activeScene)}</p>
                </div>
              </div>
            ) : null}

            {!ready && !failed ? <p className="holographic-media-status">Loading mural…</p> : null}
            {failed ? <p className="holographic-media-status holographic-media-error">This mural cannot play right now.</p> : null}
          </div>

          <div className="holographic-transport-bar">
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
              <label className="holographic-volume">
                <span className="sr-only">Volume</span>
                <button
                  type="button"
                  className="holographic-mute"
                  aria-pressed={!muted && volume > 0}
                  aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                  onClick={() => setMuted((value) => !value)}
                >
                  {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  aria-label="Volume"
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setVolume(next);
                    setMuted(next === 0);
                  }}
                />
              </label>
              <button
                type="button"
                className="holographic-fullscreen"
                aria-label="Fullscreen"
                onClick={() => void cinemaRef.current?.requestFullscreen?.()}
              >
                <Maximize2 size={14} />
              </button>
              <div
                className="holographic-progress"
                role="slider"
                tabIndex={0}
                aria-valuemin={0}
                aria-valuemax={Math.round(durationMs)}
                aria-valuenow={Math.round(timeMs)}
                aria-label="Experience progress"
                onClick={(event) => seekFromProgress(event.clientX, event.currentTarget)}
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
          </div>
        </>
      ) : null}

      {showComposition ? (
        <div className="world-experience holographic-composition">
          {scenes.length > 0 ? (
            <section className="world-section" aria-labelledby="experience-scenes-heading">
              <div className="world-section-head">
                <div>
                  <p className="world-kicker">Reveal</p>
                  <h2 id="experience-scenes-heading" className="world-section-title">
                    Scenes
                  </h2>
                  <p className="world-section-note">
                    Canonical spatial units in the Mural. Select a Scene to seek playback. Timing stays canonical.
                  </p>
                </div>
                {links?.sceneDeckHref ? (
                  <Link href={links.sceneDeckHref} className="world-presence-link">
                    Continue to Scene Deck
                  </Link>
                ) : null}
              </div>
              <ol className="world-encounter-grid holographic-orbit holographic-orbit-scenes" data-holographic-orbit="scenes">
                {scenes.map((layer, index) => {
                  const active = layerIsActive(layer, timeMs);
                  const title = layerTitle(layer);
                  const shortTitle = sceneShortTitle(layer.title) ?? title;
                  const href = links?.sceneHref[layer.master_id];
                  const related = relatedMomentTitles(layer.master_id);
                  return (
                    <li key={layer.layer_id}>
                      <article className="world-encounter" aria-labelledby={`experience-scene-${layer.master_id}`}>
                        <button
                          type="button"
                          className={cn(
                            "world-encounter-link holographic-layer holographic-layer-scene",
                            active && "holographic-layer-active",
                            !active && "holographic-layer-inactive",
                          )}
                          data-holographic-kind="scene"
                          data-master-id={layer.master_id}
                          data-layer-active={active ? "true" : "false"}
                          onClick={() => seekScene(layer)}
                        >
                          {stillSurface(layer, title, "world-still")}
                          <p className="world-encounter-ordinal">{sceneOrdinal(index)}</p>
                          <h3 id={`experience-scene-${layer.master_id}`} className="world-encounter-title">
                            {shortTitle}
                          </h3>
                          {layer.title && layer.title !== shortTitle ? (
                            <p className="world-encounter-full">{layer.title}</p>
                          ) : null}
                          {layer.start_ms != null && layer.end_ms != null ? (
                            <p className="world-encounter-full">
                              {formatTimelineMs(layer.start_ms)} → {formatTimelineMs(layer.end_ms)}
                            </p>
                          ) : null}
                          {related.length > 0 ? (
                            <p className="world-encounter-full">
                              {related.length > 1 ? "Creative Moments · " : "Creative Moment · "}
                              {related.join(" · ")}
                            </p>
                          ) : null}
                        </button>
                        {href ? (
                          <Link href={href} className="world-presence-link">
                            Open Scene
                            <span className="sr-only">{` ${shortTitle}`}</span>
                          </Link>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {moments.length > 0 ? (
            <section className="world-section" aria-labelledby="experience-moments-heading">
              <p className="world-kicker">Reveal</p>
              <h2 id="experience-moments-heading" className="world-section-title">
                Creative Moments
              </h2>
              <p className="world-section-note">
                Contributors present in this Universe. A Creative Moment can relate to more than one Scene.
              </p>
              <ul className="world-presence-list holographic-orbit holographic-orbit-moments" data-holographic-orbit="moments">
                {moments.map((layer) => {
                  const active = layerIsActive(layer, timeMs);
                  const title = layerTitle(layer);
                  const related = relatedSceneTitles(layer);
                  const href = links?.momentHref[layer.master_id];
                  return (
                    <li key={layer.layer_id}>
                      <article
                        className={cn(
                          "world-presence holographic-layer holographic-layer-moment",
                          active && "holographic-layer-active",
                          !active && "holographic-layer-inactive",
                        )}
                        data-holographic-kind="moment"
                        data-master-id={layer.master_id}
                        data-moment-id={layer.master_id}
                        data-layer-active={active ? "true" : "false"}
                        aria-labelledby={`experience-moment-${layer.master_id}`}
                      >
                        {stillSurface(layer, title, "world-still")}
                        <h3 id={`experience-moment-${layer.master_id}`} className="world-presence-title">
                          {title}
                        </h3>
                        <p className="world-presence-kind">Creative identity in this Universe</p>
                        {related.length > 0 ? (
                          <p className="world-presence-scenes">
                            {related.length > 1 ? "Present across " : "Present in "}
                            {related.join(" and ")}
                          </p>
                        ) : null}
                        {href ? (
                          <Link href={href} className="world-presence-link">
                            View Creative Moment
                            <span className="sr-only">{` ${title}`}</span>
                          </Link>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {productions.length > 0 ? (
            <section className="world-section" aria-labelledby="experience-production-heading">
              <p className="world-kicker">Assemble</p>
              <h2 id="experience-production-heading" className="world-section-title">
                Production
              </h2>
              <p className="world-section-note">Playable results that have been approved to join the Experience.</p>
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
            </section>
          ) : null}
        </div>
      ) : null}

      {mode === "studio" && current ? (
        <p className="holographic-window holographic-studio-window">
          Active window {formatWindowRange(current)}
        </p>
      ) : null}
    </div>
  );
}

export type { HolographicLayer };

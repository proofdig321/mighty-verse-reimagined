"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type TouchEvent, type ReactNode } from "react";
import Link from "next/link";
import { Maximize2, Volume2, VolumeX } from "lucide-react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { muxStillFromPlayback } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneOrdinal, sceneShortTitle } from "@/lib/assemble/composition";
import { PlayerControls } from "@/components/player/player-controls";
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
import { attachHolographicAudio, type HolographicAudioGraph } from "@/lib/experience/holographic-spatial-audio";
import { MouseViewController, OrientationViewController } from "@/lib/experience/viewer-pose";
import { NEUTRAL_VIEWER_POSE, type ViewerPose } from "@/lib/experience/spatial-types";
import { useXRSession } from "@/lib/experience/use-xr-session";
import { HolographicLayerMedia } from "./holographic-layer-media";
import { HolographicTheater } from "./holographic-theater";
import { CreativeMomentCard } from "./creative-moment-card";
import { DepthIndex } from "@/lib/experience/depth-asset";
import { decodeDepthMeta, decodeDepthFrame, depthAssetFromMeta } from "@/lib/experience/depth-format";

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
  depthSignedUrl,
  initialSeekMs,
}: {
  program: HolographicProgram;
  compact?: boolean;
  mode?: "public" | "studio";
  showCinema?: boolean;
  showComposition?: boolean;
  links?: ExperienceSurfaceLinks | null;
  onSelectScene?: (sceneMasterId: string, startMs: number) => void;
  /** Signed URL for the MVDP depth asset. Null = synthetic fallback. */
  depthSignedUrl?: string | null;
  /** Optional: seek to this timestamp on first play (e.g. from ?scene= param). */
  initialSeekMs?: number | null;
}) {
  const cinemaRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MouseViewController>(new MouseViewController());
  const orientationRef = useRef<OrientationViewController>(new OrientationViewController());
  const poseRef = useRef<ViewerPose>(NEUTRAL_VIEWER_POSE);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HolographicAudioGraph | null>(null);
  const depthIndexRef = useRef<DepthIndex | null>(null);
  const { xrSessionRef, xrSupported, xrActive, enterXR, exitXR } = useXRSession(poseRef);
  const [gyroActive, setGyroActive] = useState(false);

  // Streaming depth decode — same pattern as SpatialPresentation.
  useEffect(() => {
    if (!depthSignedUrl) return;
    let cancelled = false;
    fetch(depthSignedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`depth fetch ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        if (cancelled) return;
        const meta = decodeDepthMeta(buf);
        const frames = Array.from({ length: meta.frameCount }, (_, i) =>
          decodeDepthFrame(buf, meta, i),
        );
        depthIndexRef.current = new DepthIndex(depthAssetFromMeta(depthSignedUrl, meta), frames);
      })
      .catch(() => { /* synthetic fallback remains active */ });
    return () => { cancelled = true; };
  }, [depthSignedUrl]);

  // Gyroscope — attach/detach OrientationViewController.
  useEffect(() => {
    const ctrl = orientationRef.current;
    if (gyroActive) {
      ctrl.attach();
    } else {
      ctrl.detach();
    }
    return () => ctrl.detach();
  }, [gyroActive]);

  // Merge gyro pose into poseRef each rAF when active.
  useEffect(() => {
    if (!gyroActive) return;
    let raf = 0;
    const tick = () => {
      poseRef.current = orientationRef.current.getPose();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gyroActive]);

  async function enableGyro() {
    const granted = await orientationRef.current.requestPermission();
    if (granted) setGyroActive(true);
  }
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(!program.clock);
  const [failed, setFailed] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [seekNonce, setSeekNonce] = useState(0);
  const [seekToMs, setSeekToMs] = useState<number | null>(initialSeekMs ?? null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const durationMs = program.duration_ms || 1;
  const current = activeWindow(program.windows, timeMs);
  const progress = Math.min(1, timeMs / durationMs);
  const mural = program.layers.find((layer) => layer.kind === "mural") ?? null;
  const scenes = program.layers.filter((layer) => layer.kind === "scene");
  const moments = program.layers.filter((layer) => layer.kind === "moment");
  const productions = program.layers.filter((layer) => layer.kind === "production");
  const spatialLayers = [...scenes, ...moments];

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
    if (gyroActive) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    controllerRef.current.onPointerMove(event.clientX, event.clientY, rect);
    poseRef.current = controllerRef.current.getPose();
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (gyroActive) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    controllerRef.current.onPointerMove(touch.clientX, touch.clientY, rect);
    poseRef.current = controllerRef.current.getPose();
  }

  function onLeave() {
    if (gyroActive) return;
    controllerRef.current.onPointerLeave();
    poseRef.current = NEUTRAL_VIEWER_POSE;
  }

  function restart() {
    setTimeMs(0);
    setSeekToMs(0);
    setPlaying(false);
    setSeekNonce((value) => value + 1);
  }

  function unlockSpatialAudio() {
    const video = videoRef.current;
    if (!video) return;
    audioRef.current = attachHolographicAudio(video);
    void audioRef.current?.resume();
  }

  function toggle() {
    if (timeMs >= durationMs) {
      setTimeMs(0);
      setSeekToMs(0);
      setSeekNonce((value) => value + 1);
    }
    if (!playing) {
      setMuted(false);
      unlockSpatialAudio();
    }
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
    setMuted(false);
    unlockSpatialAudio();
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
      setMuted((value) => {
        const next = !value;
        if (!next) unlockSpatialAudio();
        return next;
      });
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
    const sceneStill =
      layer.kind === "production"
        ? scenes.find((scene) => scene.master_id === layer.master_id)?.still_url ?? null
        : null;
    const still =
      sceneStill ||
      layer.still_url ||
      muxStillFromPlayback(layer.playback_endpoint, 1, 960);
    if (still) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" className={className || "world-still"} />
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
      aria-label={`${mode === "public" ? "Holographic Experience" : "2.5D Experience"} stage for ${program.title}`}
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
            data-hologram={program.clock ? "live" : "still"}
            ref={cinemaRef}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onLeave}
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
                    mediaRef={videoRef}
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

            {program.clock || spatialLayers.length > 0 ? (
              <HolographicTheater
                layers={spatialLayers}
                timeMs={timeMs}
                poseRef={poseRef}
                videoRef={videoRef}
                audioRef={audioRef}
                depthIndexRef={depthIndexRef}
                xrSessionRef={xrSessionRef}
              />
            ) : null}

            {!ready && !failed ? <p className="holographic-media-status">Loading mural…</p> : null}
            {failed ? <p className="holographic-media-status holographic-media-error">This mural cannot play right now.</p> : null}

            {/* Gyro enable button — shown on devices with orientation support */}
            {typeof DeviceOrientationEvent !== "undefined" && !gyroActive ? (
              <button
                type="button"
                className="spatial-gyro-btn"
                aria-label="Enable gyroscope parallax"
                onClick={() => void enableGyro()}
              >
                Tilt
              </button>
            ) : null}

            {xrSupported ? (
              <button
                type="button"
                className="spatial-xr-btn"
                aria-label={xrActive ? "Exit VR" : "Enter VR"}
                onClick={xrActive ? exitXR : () => void enterXR()}
              >
                {xrActive ? "Exit VR" : "Enter VR"}
              </button>
            ) : null}
          </div>

          <div className="holographic-transport-bar">
            <PlayerControls
              currentMs={timeMs}
              durationMs={durationMs}
              playing={playing}
              muted={muted}
              volume={volume}
              markers={program.windows.map((w) => ({ id: w.scene_master_id, positionMs: w.start_ms, label: w.title }))}
              contextLabel={current ? audienceLayerTitle(current.title, "Scene") : playing ? "Opening" : "Ready"}
              variant="holographic"
              showFullscreen
              showVolume
              containerRef={cinemaRef as React.RefObject<HTMLElement | null>}
              onTogglePlay={toggle}
              onRestart={restart}
              onSeek={seekTo}
              onMuteToggle={() => setMuted((v) => { const next = !v; if (!next) unlockSpatialAudio(); return next; })}
              onVolumeChange={(v) => { setVolume(v); setMuted(v === 0); if (v > 0) unlockSpatialAudio(); }}
            />
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
                    Canonical Scene Exploration
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
                Creative Moments & Contributors
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
                      <CreativeMomentCard
                        masterId={layer.master_id}
                        title={title}
                        stillUrl={layer.still_url}
                        href={href}
                        sceneTitles={related}
                        kind="Creative identity in this Universe"
                        copyMode="hover"
                        active={active}
                      />
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
                          posterUrl={
                            scenes.find((scene) => scene.master_id === layer.master_id)?.still_url ||
                            layer.still_url ||
                            muxStillFromPlayback(layer.playback_endpoint, 1, 960)
                          }
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

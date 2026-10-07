"use client";

import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import { Maximize2 } from "lucide-react";
import { HolographicTheater } from "@/components/experience/holographic-theater";
import { HolographicLayerMedia, type HolographicMediaClock } from "@/components/experience/holographic-layer-media";
import { MouseViewController, OrientationViewController } from "@/lib/experience/viewer-pose";
import { NEUTRAL_VIEWER_POSE, type ViewerPose } from "@/lib/experience/spatial-types";
import { formatDuration } from "@/lib/media/timing";
import { DepthIndex } from "@/lib/experience/depth-asset";
import { decodeDepthMeta, decodeDepthFrame, depthAssetFromMeta } from "@/lib/experience/depth-format";

/**
 * SpatialPresentation — genuine lightweight 2.5D spatial presentation.
 *
 * Composes the existing Mighty Verse spatial primitives:
 *   HolographicTheater  — WebGL1 renderer (unchanged)
 *   HolographicLayerMedia — HLS video source (unchanged)
 *   MouseViewController — pointer → ViewerPose (unchanged)
 *   ViewerPose / holographicPoseUniforms — spatial input contract (unchanged)
 *   DepthController — depth pipeline (unchanged, synthetic fallback active)
 *
 * Deliberately lighter than HolographicStage:
 *   - No spatial audio (HolographicStage has it)
 *   - No layered Scene/Moment/Production composition (HolographicStage has it)
 *   - No rVFC wiring beyond what HolographicTheater already does internally
 *   - Cinema + viewer-controlled parallax + depth + transport only
 *
 * The distinction is architectural: this is the cinema alone.
 * HolographicStage is the full composed spatial experience.
 *
 * When genuine VDA-Small depth becomes available, pass depthControllerRef
 * through to HolographicTheater — no renderer changes required.
 */
export type SpatialPresentationClock = HolographicMediaClock & {
  duration_ms: number | null;
};

export function SpatialPresentation({
  clock,
  posterUrl,
  title,
  initialSeekMs,
  depthSignedUrl,
}: {
  clock: SpatialPresentationClock;
  posterUrl?: string | null;
  title: string;
  /** Optional: seek to this timestamp on first play (e.g. from ?scene= param). */
  initialSeekMs?: number | null;
  /** Signed URL for the MVDP depth asset. Null = synthetic fallback. */
  depthSignedUrl?: string | null;
}) {
  const cinemaRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MouseViewController>(new MouseViewController());
  const orientationRef = useRef<OrientationViewController>(new OrientationViewController());
  const poseRef = useRef<ViewerPose>(NEUTRAL_VIEWER_POSE);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const depthIndexRef = useRef<DepthIndex | null>(null);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroActive, setGyroActive] = useState(false);

  // Streaming depth decode: fetch buffer once, decode meta + timestamp index,
  // then decode individual frames on demand via DepthIndex lazy loader.
  // Avoids loading all frame pixels into memory at once (~225 MB for 254s).
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
        // Decode all frames from the retained buffer — each frame slice is
        // copied out of the buffer so the buffer itself can be GC'd after
        // DepthIndex construction.
        const frames = Array.from({ length: meta.frameCount }, (_, i) =>
          decodeDepthFrame(buf, meta, i),
        );
        depthIndexRef.current = new DepthIndex(depthAssetFromMeta(depthSignedUrl, meta), frames);
      })
      .catch(() => { /* synthetic fallback remains active */ });
    return () => { cancelled = true; };
  }, [depthSignedUrl]);

  // Detect gyroscope availability on mount (passive — no permission yet).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof DeviceOrientationEvent !== "undefined") setGyroAvailable(true);
  }, []);

  // Attach / detach OrientationViewController when gyro is active.
  useEffect(() => {
    const ctrl = orientationRef.current;
    if (gyroActive) {
      ctrl.attach();
    } else {
      ctrl.detach();
    }
    return () => ctrl.detach();
  }, [gyroActive]);

  // Merge gyro pose into poseRef each animation frame when active.
  // When gyro is active it takes precedence over pointer.
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [seekNonce, setSeekNonce] = useState(0);
  const [seekToMs, setSeekToMs] = useState<number | null>(initialSeekMs ?? null);
  const [muted, setMuted] = useState(true);
  // Track whether the pointer is over the cinema for the depth indicator
  const [pointerActive, setPointerActive] = useState(false);

  const durationMs = clock.duration_ms ?? 0;
  const progress = durationMs > 0 ? Math.min(1, timeMs / durationMs) : 0;

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (gyroActive) return; // gyro takes precedence on mobile
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    controllerRef.current.onPointerMove(event.clientX, event.clientY, rect);
    poseRef.current = controllerRef.current.getPose();
    setPointerActive(true);
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (gyroActive) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = event.currentTarget.getBoundingClientRect();
    controllerRef.current.onPointerMove(touch.clientX, touch.clientY, rect);
    poseRef.current = controllerRef.current.getPose();
    setPointerActive(true);
  }

  function onLeave() {
    if (gyroActive) return;
    controllerRef.current.onPointerLeave();
    poseRef.current = NEUTRAL_VIEWER_POSE;
    setPointerActive(false);
  }

  function toggle() {
    if (timeMs >= durationMs && durationMs > 0) {
      setSeekToMs(0);
      setSeekNonce((n) => n + 1);
    }
    if (!playing) setMuted(false);
    setPlaying((p) => !p);
  }

  function seekFromProgress(clientX: number, element: HTMLElement) {
    if (durationMs <= 0) return;
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    setSeekToMs(Math.round(ratio * durationMs));
  }

  return (
    <div
      className="spatial-presentation"
      data-spatial-playing={playing ? "true" : "false"}
      data-spatial-ready={ready ? "true" : "false"}
      data-spatial-mode="2.5d"
    >
      {/* Cinema — pointer events drive ViewerPose */}
      <div
        className="holographic-cinema spatial-cinema"
        ref={cinemaRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onTouchMove={onTouchMove}
        onTouchEnd={onLeave}
      >
        {/* Video source — HolographicLayerMedia owns the <video> element.
             .holographic-layer-mural is required so the CSS hide rule fires
             when the WebGL canvas reports data-holographic-warp="live". */}
        <div data-holographic-kind="mural" className="holographic-layer holographic-layer-mural">
          <HolographicLayerMedia
            clock={clock}
            posterUrl={posterUrl}
            title={title}
            playing={playing}
            muted={muted}
            seekNonce={seekNonce}
            seekToMs={seekToMs}
            mediaRef={videoRef}
            onTimeMs={setTimeMs}
            onReady={() => { setReady(true); setFailed(false); }}
            onError={() => setFailed(true)}
            onPlayingChange={setPlaying}
            onEnded={() => { setPlaying(false); if (durationMs > 0) setTimeMs(durationMs); }}
          />
        </div>

        {/* Spatial renderer — same HolographicTheater used by HolographicStage */}
        <HolographicTheater
          layers={[]}
          timeMs={timeMs}
          poseRef={poseRef}
          videoRef={videoRef}
          depthIndexRef={depthIndexRef}
        />

        {/* Depth indicator — communicates that parallax is active */}
        <div
          className="spatial-depth-indicator"
          aria-hidden="true"
          data-active={pointerActive || gyroActive ? "true" : "false"}
        >
          <span className="spatial-depth-label">
            {gyroActive ? "Gyro active" : pointerActive ? "Depth active" : "Move pointer to shift perspective"}
          </span>
        </div>

        {/* Gyro enable button — shown on devices with orientation support */}
        {gyroAvailable && !gyroActive ? (
          <button
            type="button"
            className="spatial-gyro-btn"
            aria-label="Enable gyroscope parallax"
            onClick={() => void enableGyro()}
          >
            Tilt
          </button>
        ) : null}

        {!ready && !failed ? (
          <p className="holographic-media-status">Loading…</p>
        ) : null}
        {failed ? (
          <p className="holographic-media-status holographic-media-error">
            This mural cannot play right now.
          </p>
        ) : null}
      </div>

      {/* Transport bar — minimal: play/pause, time, seek, fullscreen */}
      <div className="holographic-transport-bar">
        <div className="holographic-transport spatial-transport">
          <button
            type="button"
            className="holographic-transport-play"
            aria-pressed={playing}
            onClick={toggle}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <p className="holographic-transport-time">
            {formatDuration(timeMs / 1000)}
            {durationMs > 0 ? ` / ${formatDuration(durationMs / 1000)}` : ""}
          </p>
          <button
            type="button"
            className="holographic-mute"
            aria-pressed={!muted}
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            className="holographic-fullscreen"
            aria-label="Fullscreen"
            onClick={() => void cinemaRef.current?.requestFullscreen?.()}
          >
            <Maximize2 size={14} />
          </button>
          {durationMs > 0 ? (
            <div
              className="holographic-progress"
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={Math.round(durationMs)}
              aria-valuenow={Math.round(timeMs)}
              aria-label="2.5D playback progress"
              onClick={(e) => seekFromProgress(e.clientX, e.currentTarget)}
            >
              <span style={{ width: `${progress * 100}%` }} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

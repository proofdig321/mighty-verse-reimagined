"use client";

import { useEffect, useRef } from "react";

export type HolographicMediaClock = {
  endpoint_ref: string;
  projection_id?: string;
  master_id?: string;
  canonical_state_id?: string;
  start_ms?: number | null;
  end_ms?: number | null;
};

/**
 * Mux HLS surface for the holographic stage.
 *
 * One instance is the Experience clock (mural). Additional instances play
 * approved production layers when their Scene window is active.
 * Provider identifiers stay off the visible surface.
 */
export function HolographicLayerMedia({
  clock,
  posterUrl,
  title,
  playing,
  muted = true,
  loop = false,
  onTimeMs,
  onReady,
  onEnded,
}: {
  clock: HolographicMediaClock;
  posterUrl?: string | null;
  title: string;
  playing: boolean;
  muted?: boolean;
  loop?: boolean;
  onTimeMs?: (ms: number) => void;
  onReady?: () => void;
  onEnded?: () => void;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const onTimeRef = useRef(onTimeMs);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  const playingRef = useRef(playing);

  useEffect(() => {
    onTimeRef.current = onTimeMs;
    onReadyRef.current = onReady;
    onEndedRef.current = onEnded;
    playingRef.current = playing;
  }, [onTimeMs, onReady, onEnded, playing]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const startSec = clock.start_ms != null ? clock.start_ms / 1000 : 0;
    const endSec = clock.end_ms != null ? clock.end_ms / 1000 : null;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;

    function attachRange() {
      if (!media) return;
      media.currentTime = startSec;
      onReadyRef.current?.();
      if (playingRef.current) media.play().catch(() => null);
    }

    async function loadHls() {
      if (!media) return;
      const { default: Hls } = await import("hls.js");
      if (cancelled || !media) return;
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: false });
        hls = instance;
        instance.loadSource(clock.endpoint_ref);
        instance.attachMedia(media);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) attachRange();
        });
      } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = clock.endpoint_ref;
        media.addEventListener("loadedmetadata", attachRange, { once: true });
      }
    }

    function onTime() {
      if (!media) return;
      const ms = Math.round(media.currentTime * 1000);
      onTimeRef.current?.(ms);
      if (endSec != null && media.currentTime >= endSec) {
        media.pause();
        media.currentTime = startSec;
        onEndedRef.current?.();
      }
    }

    function onPlay() {
      if (!clock.projection_id || !clock.master_id || !clock.canonical_state_id) return;
      fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectionId: clock.projection_id,
          masterId: clock.master_id,
          canonicalStateId: clock.canonical_state_id,
          signalType: "play",
          sessionRef: "experience",
        }),
      }).catch(() => null);
    }

    function onNativeEnded() {
      if (endSec != null) return;
      onEndedRef.current?.();
    }

    media.addEventListener("timeupdate", onTime);
    media.addEventListener("play", onPlay);
    media.addEventListener("ended", onNativeEnded);
    loadHls().catch(() => null);

    return () => {
      cancelled = true;
      media.removeEventListener("timeupdate", onTime);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("ended", onNativeEnded);
      hls?.destroy();
    };
  }, [clock.endpoint_ref, clock.start_ms, clock.end_ms, clock.projection_id, clock.master_id, clock.canonical_state_id]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (playing) {
      media.play().catch(() => null);
    } else {
      media.pause();
    }
  }, [playing]);

  function restart() {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = clock.start_ms != null ? clock.start_ms / 1000 : 0;
  }

  return (
    <div className="holographic-layer-media" data-holographic-media="">
      <video
        ref={mediaRef}
        poster={posterUrl ?? undefined}
        playsInline
        muted={muted}
        loop={loop && clock.end_ms == null}
        aria-label={`${title} playback`}
        onLoadedData={restart}
      />
    </div>
  );
}

export function seekHolographicMedia(root: HTMLElement | null, ms: number) {
  const media = root?.querySelector("video");
  if (media) media.currentTime = Math.max(0, ms / 1000);
}

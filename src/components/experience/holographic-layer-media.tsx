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
  volume = 1,
  loop = false,
  seekNonce = 0,
  seekToMs = null,
  mediaRef: parentMediaRef,
  onTimeMs,
  onReady,
  onEnded,
  onPlayingChange,
  onError,
}: {
  clock: HolographicMediaClock;
  posterUrl?: string | null;
  title: string;
  playing: boolean;
  muted?: boolean;
  volume?: number;
  loop?: boolean;
  seekNonce?: number;
  seekToMs?: number | null;
  mediaRef?: { current: HTMLVideoElement | null };
  onTimeMs?: (ms: number) => void;
  onReady?: () => void;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onError?: () => void;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);

  function setMedia(node: HTMLVideoElement | null) {
    mediaRef.current = node;
    if (parentMediaRef) parentMediaRef.current = node;
  }
  const onTimeRef = useRef(onTimeMs);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  const onPlayingRef = useRef(onPlayingChange);
  const onErrorRef = useRef(onError);
  const playingRef = useRef(playing);

  useEffect(() => {
    onTimeRef.current = onTimeMs;
    onReadyRef.current = onReady;
    onEndedRef.current = onEnded;
    onPlayingRef.current = onPlayingChange;
    onErrorRef.current = onError;
    playingRef.current = playing;
  }, [onTimeMs, onReady, onEnded, onPlayingChange, onError, playing]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.crossOrigin = "anonymous";
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
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) onErrorRef.current?.();
        });
      } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = clock.endpoint_ref;
        media.addEventListener("loadedmetadata", attachRange, { once: true });
        media.addEventListener("error", () => onErrorRef.current?.(), { once: true });
      } else {
        onErrorRef.current?.();
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
      onPlayingRef.current?.(true);
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

    function onPause() {
      onPlayingRef.current?.(false);
    }

    function onNativeEnded() {
      if (endSec != null) return;
      onEndedRef.current?.();
    }

    media.addEventListener("timeupdate", onTime);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    media.addEventListener("ended", onNativeEnded);
    loadHls().catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      media.removeEventListener("timeupdate", onTime);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
      media.removeEventListener("ended", onNativeEnded);
      hls?.destroy();
      if (parentMediaRef && parentMediaRef.current === media) {
        parentMediaRef.current = null;
      }
    };
  }, [clock.endpoint_ref, clock.start_ms, clock.end_ms, clock.projection_id, clock.master_id, clock.canonical_state_id, parentMediaRef]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (playing) {
      media.muted = muted;
      media.play().catch(() => null);
    } else {
      media.pause();
    }
  }, [playing, muted]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = muted;
    media.volume = Math.min(1, Math.max(0, volume));
  }, [muted, volume]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = clock.start_ms != null ? clock.start_ms / 1000 : 0;
  }, [seekNonce, clock.start_ms]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || seekToMs == null) return;
    media.currentTime = Math.max(0, seekToMs / 1000);
  }, [seekToMs]);

  return (
    <div className="holographic-layer-media" data-holographic-media="">
      <video
        ref={setMedia}
        poster={posterUrl ?? undefined}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        muted={muted}
        loop={loop && clock.end_ms == null}
        aria-label={`${title} playback`}
      />
    </div>
  );
}

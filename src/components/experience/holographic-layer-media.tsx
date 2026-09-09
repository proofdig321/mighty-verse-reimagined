"use client";

import { useEffect, useRef, useState } from "react";

export type HolographicPlayback = {
  playback_id: string;
  endpoint_ref: string;
  projection_id: string;
  master_id: string;
  canonical_state_id: string;
  start_ms?: number | null;
  end_ms?: number | null;
};

export function HolographicLayerMedia({
  playback,
  posterUrl,
  title,
}: {
  playback: HolographicPlayback;
  posterUrl?: string | null;
  title: string;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const startSec = playback.start_ms != null ? playback.start_ms / 1000 : null;
    const endSec = playback.end_ms != null ? playback.end_ms / 1000 : null;
    let hls: { destroy: () => void } | undefined;
    let cancelled = false;

    function attachRange() {
      if (!media) return;
      if (startSec != null) media.currentTime = startSec;
    }

    async function loadHls() {
      if (!media) return;
      const { default: Hls } = await import("hls.js");
      if (cancelled || !media) return;
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: false });
        hls = instance;
        instance.loadSource(playback.endpoint_ref);
        instance.attachMedia(media);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          attachRange();
          setReady(true);
        });
      } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = playback.endpoint_ref;
        media.addEventListener("loadedmetadata", () => {
          attachRange();
          setReady(true);
        }, { once: true });
      }
    }

    function onTime() {
      if (!media || endSec == null) return;
      if (media.currentTime >= endSec) {
        media.pause();
        media.currentTime = startSec ?? 0;
        setPlaying(false);
      }
    }

    media.addEventListener("timeupdate", onTime);
    loadHls().catch(() => null);

    return () => {
      cancelled = true;
      media.removeEventListener("timeupdate", onTime);
      hls?.destroy();
    };
  }, [playback.endpoint_ref, playback.start_ms, playback.end_ms]);

  async function toggle() {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      try {
        await media.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      media.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="holographic-layer-media">
      <video
        ref={mediaRef}
        poster={posterUrl ?? undefined}
        playsInline
        muted
        loop={playback.end_ms == null}
        aria-label={`${title} playback`}
      />
      <button type="button" className="holographic-play" onClick={() => void toggle()} aria-pressed={playing}>
        {playing ? "Pause" : ready ? "Play" : "Load"}
      </button>
    </div>
  );
}

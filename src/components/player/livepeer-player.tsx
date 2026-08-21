"use client";

import { useEffect, useRef } from "react";

interface LivepeerPlayerProps {
  playbackId: string;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  startMs: number | null;
  endMs: number | null;
}

export function LivepeerPlayer({ playbackId, projectionId, masterId, canonicalStateId, startMs, endMs }: LivepeerPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startSec = startMs != null ? startMs / 1000 : null;
    const endSec   = endMs   != null ? endMs   / 1000 : null;

    function attachRange() {
      if (!video) return;
      if (startSec != null) video.currentTime = startSec;

      if (endSec != null) {
        const onTimeUpdate = () => {
          if (video.currentTime >= endSec) {
            video.pause();
            video.currentTime = startSec ?? 0;
          }
        };
        video.addEventListener("timeupdate", onTimeUpdate);
        return () => video.removeEventListener("timeupdate", onTimeUpdate);
      }
    }

    fetch(`/api/livepeer/playback/${playbackId}`)
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        if (!info) return;
        const hls = info?.meta?.source?.find((s: { type: string; url: string }) => s.type === "html5/application/vnd.apple.mpegurl");
        if (!hls) return;

        const poster = hls.url.replace("/index.m3u8", "/thumbnails/keyframes_0.png");
        if (poster && !video.poster) video.poster = poster;

        const onLoaded = () => attachRange();
        video.addEventListener("loadedmetadata", onLoaded, { once: true });

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hls.url;
        } else {
          import("hls.js").then(({ default: Hls }) => {
            if (Hls.isSupported()) {
              const h = new Hls();
              h.loadSource(hls.url);
              h.attachMedia(video);
            }
          });
        }
      })
      .catch(() => null);

    const onPlay = () => fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectionId, masterId, canonicalStateId, signalType: "play", sessionRef: playbackId }),
    }).catch(() => null);

    video.addEventListener("play", onPlay);
    return () => video.removeEventListener("play", onPlay);
  }, [playbackId, projectionId, masterId, canonicalStateId, startMs, endMs]);

  return (
    <video
      ref={videoRef}
      controls
      style={{ width: "100%", aspectRatio: "16/9", background: "#000", display: "block" }}
    />
  );
}

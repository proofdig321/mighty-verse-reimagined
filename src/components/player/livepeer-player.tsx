"use client";

import { useEffect, useRef } from "react";

interface LivepeerPlayerProps {
  playbackId: string;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
}

export function LivepeerPlayer({ playbackId, projectionId, masterId, canonicalStateId }: LivepeerPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    fetch(`/api/livepeer/playback/${playbackId}`)
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        if (!info) return;
        const hls = info?.meta?.source?.find((s: { type: string; url: string }) => s.type === "html5/application/vnd.apple.mpegurl");
        if (!hls) return;

        // Native HLS (Safari) or hls.js for other browsers
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

    // Consumption signal on play
    const onPlay = () => fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectionId, masterId, canonicalStateId, signalType: "play", sessionRef: playbackId }),
    }).catch(() => null);

    video.addEventListener("play", onPlay);
    return () => video.removeEventListener("play", onPlay);
  }, [playbackId, projectionId, masterId, canonicalStateId]);

  return (
    <video
      ref={videoRef}
      controls
      style={{ width: "100%", aspectRatio: "16/9", background: "#000", display: "block" }}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";

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
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

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
        if (!info) { setState("error"); return; }
        const hls = info?.meta?.source?.find((s: { type: string; url: string }) => s.type === "html5/application/vnd.apple.mpegurl");
        if (!hls) { setState("error"); return; }

        const poster = hls.url.replace("/index.m3u8", "/thumbnails/keyframes_0.png");
        if (poster && !video.poster) video.poster = poster;

        const onLoaded = () => attachRange();
        video.addEventListener("loadedmetadata", onLoaded, { once: true });
        video.addEventListener("canplay", () => setState("ready"), { once: true });
        video.addEventListener("error", () => setState("error"), { once: true });

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
      .catch(() => setState("error"));

    const onPlay = () => fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectionId, masterId, canonicalStateId, signalType: "play", sessionRef: playbackId }),
    }).catch(() => null);

    video.addEventListener("play", onPlay);
    return () => video.removeEventListener("play", onPlay);
  }, [playbackId, projectionId, masterId, canonicalStateId, startMs, endMs]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-black shadow-2xl shadow-black/30">
      <video
        ref={videoRef}
        controls
        aria-label="Mighty Verse media player"
        className="block aspect-video w-full bg-black object-contain"
      />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-xs text-white/80">
            <LoaderCircle size={14} className="animate-spin" /> Loading media
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/75 p-6 text-center">
          <div className="space-y-2 text-white/75">
            <AlertCircle size={20} className="mx-auto text-destructive" />
            <p className="text-sm">This media is unavailable right now.</p>
            <p className="text-xs text-white/45">The publication record is still intact.</p>
          </div>
        </div>
      )}
    </div>
  );
}

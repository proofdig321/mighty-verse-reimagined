"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { MediaPlaybackSource } from "@/lib/media/providers/interface";

interface MuxPlayerProps {
  source: MediaPlaybackSource;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  startMs: number | null;
  endMs: number | null;
  seekToSeconds?: number | null;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
}

/**
 * Mux media player.
 *
 * Renders <audio> for audio assets and <video> for video assets.
 * Audio recordings are NOT wrapped in a <video> element.
 *
 * HLS URL is constructed by the Mux adapter — not hard-coded here.
 * For Mux: endpoint is https://stream.mux.com/{playbackId}.m3u8
 */
export function MuxPlayer({
  source,
  projectionId,
  masterId,
  canonicalStateId,
  startMs,
  endMs,
  seekToSeconds,
  onTimeUpdate,
  onDurationChange,
}: MuxPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationChangeRef.current = onDurationChange;
  }, [onTimeUpdate, onDurationChange]);

  useEffect(() => {
    if (seekToSeconds == null || !mediaRef.current || !Number.isFinite(seekToSeconds)) return;
    mediaRef.current.currentTime = seekToSeconds;
  }, [seekToSeconds]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const startSec = startMs != null ? startMs / 1000 : null;
    const endSec = endMs != null ? endMs / 1000 : null;
    const hlsUrl = source.endpoint;

    function attachRange() {
      if (!media) return;
      if (startSec != null) media.currentTime = startSec;
      if (endSec != null) {
        const onTime = () => {
          if (media.currentTime >= endSec) {
            media.pause();
            media.currentTime = startSec ?? 0;
          }
        };
        media.addEventListener("timeupdate", onTime);
        return () => media.removeEventListener("timeupdate", onTime);
      }
    }

    async function loadHls() {
      if (!media) return;
      // Native HLS support (Safari, iOS)
      if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = hlsUrl;
        media.addEventListener("loadedmetadata", () => attachRange(), { once: true });
        media.addEventListener("canplay", () => setState("ready"), { once: true });
        media.addEventListener("error", () => setState("error"), { once: true });
        return;
      }
      // HLS.js for browsers without native HLS
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsUrl);
        hls.attachMedia(media as HTMLVideoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          attachRange();
          setState("ready");
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setState("error");
        });
      } else {
        setState("error");
      }
    }

    loadHls().catch(() => setState("error"));

    const onPlay = () =>
      fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectionId,
          masterId,
          canonicalStateId,
          signalType: "play",
          sessionRef: source.playbackId,
        }),
      }).catch(() => null);

    const handleTimeUpdate = () => onTimeUpdateRef.current?.(media.currentTime);
    const handleDurationChange = () => onDurationChangeRef.current?.(media.duration);

    media.addEventListener("play", onPlay);
    media.addEventListener("timeupdate", handleTimeUpdate);
    media.addEventListener("durationchange", handleDurationChange);

    return () => {
      media.removeEventListener("play", onPlay);
      media.removeEventListener("timeupdate", handleTimeUpdate);
      media.removeEventListener("durationchange", handleDurationChange);
    };
  }, [source, projectionId, masterId, canonicalStateId, startMs, endMs]);

  const overlay = (
    <>
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
    </>
  );

  // Audio: render <audio> — never <video> for audio recordings
  if (source.mediaClass === "audio") {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          controls
          aria-label="Mighty Verse audio player"
          className="w-full"
        />
        {overlay}
      </div>
    );
  }

  // Video: render <video>
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-black shadow-2xl shadow-black/30">
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        controls
        aria-label="Mighty Verse media player"
        className="block aspect-video w-full bg-black object-contain"
      />
      {overlay}
    </div>
  );
}

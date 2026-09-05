"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipForward, SkipBack, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlaybackSegment } from "./types";

type Props = {
  segments: PlaybackSegment[];
  onClose: () => void;
};

type PlayerState = "loading" | "playing" | "paused" | "ended" | "error";

function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function TimelinePlayer({ segments, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const [segIdx, setSegIdx] = useState(0);
  const [state, setState] = useState<PlayerState>("loading");
  const [currentSec, setCurrentSec] = useState(0);
  const segIdxRef = useRef(0);

  const seg = segments[segIdx] ?? null;

  // Load a segment into the video element
  const loadSegment = useCallback(async (idx: number) => {
    const s = segments[idx];
    if (!s || !videoRef.current) return;
    const video = videoRef.current;
    setState("loading");

    // Fetch HLS URL via existing API
    const info = await fetch(`/api/livepeer/playback/${s.playbackId}`).then(r => r.ok ? r.json() : null).catch(() => null);
    if (!info) { setState("error"); return; }
    const hlsSrc = info?.meta?.source?.find((x: { type: string }) => x.type === "html5/application/vnd.apple.mpegurl")?.url;
    if (!hlsSrc) { setState("error"); return; }

    // Reuse existing HLS source if same playbackId as previous segment
    const currentSrc = video.getAttribute("data-playback-id");
    if (currentSrc !== s.playbackId) {
      // Destroy old HLS instance
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsSrc;
      } else {
        const { default: Hls } = await import("hls.js");
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(hlsSrc);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else {
          setState("error"); return;
        }
      }
      video.setAttribute("data-playback-id", s.playbackId);
    }

    // Seek to start and play
    const seekAndPlay = () => {
      video.currentTime = s.startMs / 1000;
      video.play().then(() => setState("playing")).catch(() => setState("paused"));
    };

    if (video.readyState >= 2) {
      seekAndPlay();
    } else {
      video.addEventListener("canplay", seekAndPlay, { once: true });
    }
  }, [segments]);

  // Advance to next segment or end
  const advance = useCallback(() => {
    const next = segIdxRef.current + 1;
    if (next < segments.length) {
      segIdxRef.current = next;
      setSegIdx(next);
      loadSegment(next);
    } else {
      setState("ended");
    }
  }, [segments.length, loadSegment]);

  // Monitor timeupdate to detect segment end
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !seg) return;
    const endSec = seg.endMs / 1000;
    const onTime = () => {
      setCurrentSec(video.currentTime);
      if (video.currentTime >= endSec - 0.15) advance();
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [seg, advance]);

  // Load first segment on mount
  useEffect(() => {
    segIdxRef.current = 0;
    setSegIdx(0);
    loadSegment(0);
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [loadSegment]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setState("playing"); }
    else { v.pause(); setState("paused"); }
  }

  function goTo(idx: number) {
    if (idx < 0 || idx >= segments.length) return;
    segIdxRef.current = idx;
    setSegIdx(idx);
    loadSegment(idx);
  }

  const segDurSec = seg ? (seg.endMs - seg.startMs) / 1000 : 0;
  const segElapsed = seg ? Math.max(0, currentSec - seg.startMs / 1000) : 0;
  const progress = segDurSec > 0 ? Math.min(1, segElapsed / segDurSec) : 0;

  const totalDurSec = segments.reduce((a, s) => a + (s.endMs - s.startMs) / 1000, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Now Playing</p>
          <p className="text-sm font-semibold text-white">{seg?.title ?? "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">{segIdx + 1} / {segments.length}</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:text-white">
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-0">
        <video
          ref={videoRef}
          className="max-h-full max-w-full w-full object-contain"
          playsInline
        />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs text-white/70">
              <span className="animate-spin inline-block w-3 h-3 border border-white/40 border-t-white rounded-full" />
              Loading…
            </div>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-white/50">Media unavailable</p>
          </div>
        )}
        {state === "ended" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
            <p className="text-lg font-semibold text-white">Experience complete</p>
            <Button onClick={() => goTo(0)} style={{ background: "var(--accent-mv)" }}>Play again</Button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-white/10 px-6 py-4 space-y-3">
        {/* Segment progress bar */}
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full overflow-hidden bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, background: "var(--accent-mv)" }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{formatTime(segElapsed)}</span>
            <span>{formatTime(segDurSec)}</span>
          </div>
        </div>

        {/* Segment strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden py-1">
          {segments.map((s, i) => (
            <button
              key={s.projectionId + i}
              onClick={() => goTo(i)}
              className="shrink-0 flex flex-col items-center gap-1 group"
            >
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.max(32, ((s.endMs - s.startMs) / 1000 / totalDurSec) * 240)}px`,
                  background: i === segIdx ? "var(--accent-mv-gold)" : i < segIdx ? "var(--accent-mv)" : "rgba(255,255,255,0.15)",
                }}
              />
              <span className="text-[9px] text-white/40 group-hover:text-white/70 transition-colors max-w-[80px] truncate">
                {s.title ?? `Scene ${i + 1}`}
              </span>
            </button>
          ))}
        </div>

        {/* Playback buttons */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => goTo(segIdx - 1)} disabled={segIdx === 0} className="text-white/60 hover:text-white disabled:opacity-20">
            <SkipBack size={18} />
          </Button>
          <button
            onClick={togglePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full transition-colors"
            style={{ background: "var(--accent-mv)" }}
          >
            {state === "playing" ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
          </button>
          <Button variant="ghost" size="sm" onClick={() => goTo(segIdx + 1)} disabled={segIdx >= segments.length - 1} className="text-white/60 hover:text-white disabled:opacity-20">
            <SkipForward size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

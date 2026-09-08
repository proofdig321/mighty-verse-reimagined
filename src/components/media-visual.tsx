"use client";

import { useEffect, useState } from "react";
import { livepeerThumbnailUrl, muxThumbnailUrl } from "@/lib/media/thumbnail";

type Props = {
  playbackId?: string | null;
  /** Provider name: "mux" | "livepeer" | null. Defaults to "livepeer" for historical assets. */
  provider?: string | null;
  title: string;
  className?: string;
  aspectRatio?: "1/1" | "16/9";
  /** Scene window start. Mux stills use seconds; Livepeer stills use the matching keyframe. */
  startMs?: number | null;
};

export default function MediaVisual({
  playbackId,
  provider,
  title,
  className = "",
  aspectRatio = "16/9",
  startMs,
}: Props) {
  const resolvedProvider = provider ?? "livepeer";
  const timeSec = startMs != null ? Math.floor(startMs / 1000) : 0;
  const muxPosterUrl = resolvedProvider === "mux" && playbackId
    ? muxThumbnailUrl(playbackId, timeSec)
    : null;
  const timedLivepeerUrl =
    resolvedProvider !== "mux" && playbackId && startMs != null
      ? livepeerThumbnailUrl(playbackId, startMs)
      : null;
  const [fetchedLivepeerPosterUrl, setFetchedLivepeerPosterUrl] = useState<string | null>(null);
  const posterUrl = muxPosterUrl ?? timedLivepeerUrl ?? fetchedLivepeerPosterUrl;

  useEffect(() => {
    if (!playbackId || resolvedProvider === "mux" || startMs != null) return;
    let active = true;
    fetch(`/api/livepeer/playback/${playbackId}`)
      .then(response => response.ok ? response.json() : null)
      .then(info => {
        const hlsUrl = info?.meta?.source?.find((source: { type: string; url: string }) => source.type === "html5/application/vnd.apple.mpegurl")?.url;
        if (active && hlsUrl) setFetchedLivepeerPosterUrl(hlsUrl.replace("/index.m3u8", "/thumbnails/keyframes_0.png"));
      })
      .catch(() => null);
    return () => { active = false; };
  }, [playbackId, resolvedProvider, startMs]);

  return (
    <div className={`relative overflow-hidden bg-card border border-border ${className}`} style={{ aspectRatio }}>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-end p-5"
          style={{ background: "linear-gradient(145deg, oklch(0.30 0.08 290), oklch(0.18 0.05 280))" }}>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">{playbackId ? "Animation preview" : "Visual identity"}</span>
          <span className="mt-2 max-w-[18rem] font-[var(--font-display)] text-lg text-white/85">{title}</span>
        </div>
      )}
    </div>
  );
}

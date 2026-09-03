"use client";

import { useEffect, useState } from "react";

type Props = {
  playbackId?: string | null;
  title: string;
  className?: string;
  aspectRatio?: "1/1" | "16/9";
};

export default function MediaVisual({ playbackId, title, className = "", aspectRatio = "16/9" }: Props) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!playbackId) return;
    let active = true;
    fetch(`/api/livepeer/playback/${playbackId}`)
      .then(response => response.ok ? response.json() : null)
      .then(info => {
        const hlsUrl = info?.meta?.source?.find((source: { type: string; url: string }) => source.type === "html5/application/vnd.apple.mpegurl")?.url;
        if (active && hlsUrl) setPosterUrl(hlsUrl.replace("/index.m3u8", "/thumbnails/keyframes_0.png"));
      })
      .catch(() => null);
    return () => { active = false; };
  }, [playbackId]);

  return (
    <div className={`relative overflow-hidden bg-card border border-border ${className}`} style={{ aspectRatio }}>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-end p-5"
          style={{ background: "linear-gradient(145deg, oklch(0.22 0.06 280), oklch(0.13 0.03 280))" }}>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">{playbackId ? "Animation preview" : "Visual identity"}</span>
          <span className="mt-2 max-w-[18rem] font-[var(--font-display)] text-lg text-white/85">{title}</span>
        </div>
      )}
    </div>
  );
}

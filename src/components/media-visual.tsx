"use client";

import { muxThumbnailUrl } from "@/lib/media/thumbnail";

type Props = {
  playbackId?: string | null;
  /** Provider name: "mux" | null. */
  provider?: string | null;
  title: string;
  className?: string;
  aspectRatio?: "1/1" | "16/9";
  /** Scene window start in milliseconds. */
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
  const timeSec = startMs != null ? Math.floor(startMs / 1000) : 0;
  const posterUrl = provider === "mux" && playbackId
    ? muxThumbnailUrl(playbackId, timeSec)
    : null;

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

"use client";

import Link from "next/link";
import { useRef } from "react";
import { muxPlaybackIdFromRef, muxThumbnailUrl } from "@/lib/media/thumbnail";

export function UniverseCard({
  masterId,
  title,
  visualPlaybackId,
  visualProvider,
  attributionRoles,
  projectionCount,
}: {
  masterId: string;
  title: string | null;
  visualPlaybackId: string | null;
  visualProvider: string | null;
  attributionRoles: string[];
  projectionCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pid = visualPlaybackId ? (muxPlaybackIdFromRef(visualPlaybackId) ?? visualPlaybackId) : null;
  const isMux = pid && (visualProvider === "mux" || !visualPlaybackId?.startsWith("http"));
  const posterUrl = isMux && pid ? muxThumbnailUrl(pid, 3, 640) : null;

  function playVideo() {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    void v.play().catch(() => null);
  }

  function pauseVideo() {
    videoRef.current?.pause();
  }

  return (
    <Link
      href={`/worlds/${masterId}`}
      className="artifact-card group"
      data-universe-card={masterId}
      onMouseEnter={playVideo}
      onMouseLeave={pauseVideo}
      onTouchStart={playVideo}
    >
      <div className="artifact-card-media">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title ?? ""} />
        ) : (
          <div className="artifact-card-placeholder" />
        )}
        {pid && (
          <video
            ref={videoRef}
            className="artifact-card-hover-video"
            src={`https://stream.mux.com/${pid}.m3u8`}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="artifact-copy">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-base font-semibold text-foreground truncate group-hover:opacity-80 transition-opacity"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {title}
          </p>
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            style={{
              color: "var(--accent-mv)",
              borderColor: "color-mix(in oklch, var(--accent-mv) 40%, transparent)",
            }}
          >
            Universe
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground truncate">
          {attributionRoles.length > 0
            ? attributionRoles.map((r) => r.replace(/-/g, " ")).join(", ")
            : "Various Artists"}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{projectionCount} Creative Moment{projectionCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </Link>
  );
}

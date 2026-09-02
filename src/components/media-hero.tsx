"use client";

import ProjectionMediaPlayer from "@/components/player/projection-media-player";
import type { ProjectionMedia } from "@/components/player/projection-media-player";

type Props = {
  media: ProjectionMedia | null;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  title: string;
  typeLabel: string;
  credit: string | null;
  collectible: boolean;
  // artwork slot — null until genuine artwork exists
  artworkUrl?: string | null;
};

export default function MediaHero({
  media,
  projectionId,
  masterId,
  canonicalStateId,
  title,
  typeLabel,
  credit,
  collectible,
}: Props) {
  return (
    <div className="w-full">
      {/* Video — full bleed, no max-width constraint */}
      <div className="w-full bg-black">
        <div className="mx-auto" style={{ maxWidth: "1280px" }}>
          <ProjectionMediaPlayer
            media={media}
            projectionId={projectionId}
            masterId={masterId}
            canonicalStateId={canonicalStateId}
          />
        </div>
      </div>

      {/* Identity — below media, constrained */}
      <div className="bg-background border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              {title}
            </h1>
            {collectible && (
              <span
                className="shrink-0 mt-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}
              >
                collectible
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs uppercase tracking-widest">{typeLabel}</p>
          {credit && (
            <p className="text-muted-foreground text-sm">{credit}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  // Human-readable credit line — e.g. "Golden Shovel ft Proverb, Reason and Mothipa"
  // Falls back to role-type string when absent
  credit: string | null;
  collectible: boolean;
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
      {/* Video — full bleed, black surround */}
      <div className="w-full bg-black">
        <ProjectionMediaPlayer
          media={media}
          projectionId={projectionId}
          masterId={masterId}
          canonicalStateId={canonicalStateId}
        />
      </div>

      {/* Identity — immediately below media, no gap */}
      <div className="bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-5 space-y-1">
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-2xl font-display font-semibold leading-tight tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              {title}
            </h1>
            {collectible && (
              <span
                className="shrink-0 mt-1 text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{ color: "var(--accent-mv)", borderColor: "var(--accent-mv)" }}
              >
                collectible
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs uppercase tracking-widest">{typeLabel}</p>
          {credit && (
            <p className="text-muted-foreground text-sm pt-0.5">{credit}</p>
          )}
        </div>
      </div>
    </div>
  );
}

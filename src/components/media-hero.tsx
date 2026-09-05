"use client";

import ProjectionMediaPlayer from "@/components/player/projection-media-player";
import type { ProjectionMedia } from "@/components/player/projection-media-player";
import MediaTimeline from "@/components/player/media-timeline";
import { findActiveScene, type SceneTiming } from "@/lib/media/timing";
import SceneDeck from "@/components/scene-deck";
import type { SceneDeckItem } from "@/components/scene-deck";
import { useState } from "react";

type Props = {
  media: ProjectionMedia | null;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  title: string;
  typeLabel: string;
  credit: string | null;
  collectible: boolean;
  timelineScenes?: SceneTiming[];
  deckScenes?: SceneDeckItem[];
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
  timelineScenes = [],
  deckScenes = [],
}: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekToSeconds, setSeekToSeconds] = useState<number | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(timelineScenes[0]?.id ?? null);

  function selectScene(sceneId: string) {
    setSelectedSceneId(sceneId);
    const scene = timelineScenes.find((item) => item.id === sceneId);
    if (scene) setSeekToSeconds(scene.startMs / 1000);
  }

  function handleTimeUpdate(seconds: number) {
    setCurrentTime(seconds);
    const activeSceneId = findActiveScene(timelineScenes, seconds * 1000);
    if (activeSceneId) setSelectedSceneId(activeSceneId);
  }

  return (
    <div className="w-full">
      {/* Video — full bleed */}
      <div className="w-full bg-black">
        <div className="mx-auto" style={{ maxWidth: "1280px" }}>
          <ProjectionMediaPlayer
            media={media}
            projectionId={projectionId}
            masterId={masterId}
            canonicalStateId={canonicalStateId}
            seekToSeconds={seekToSeconds}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setDuration}
          />
        </div>
      </div>

      {/* Timeline + metadata */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{typeLabel}</p>
              <h2
                className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-foreground md:text-2xl truncate"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h2>
              {credit && (
                <p className="mt-1 max-w-xl text-xs text-muted-foreground line-clamp-2">{credit}</p>
              )}
            </div>
            {collectible && (
              <span
                className="shrink-0 text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider"
                style={{ background: "var(--accent-mv-gold)", color: "#000" }}
              >
                Collectible
              </span>
            )}
          </div>
          <MediaTimeline
            currentTime={currentTime}
            duration={duration}
            scenes={timelineScenes}
            onSeek={setSeekToSeconds}
            onSelectScene={(scene) => selectScene(scene.id)}
          />
        </div>
      </div>

      {deckScenes.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-4 py-10">
          <SceneDeck scenes={deckScenes} selectedId={selectedSceneId} onSelect={selectScene} />
        </div>
      )}
    </div>
  );
}

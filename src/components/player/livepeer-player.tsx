"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import type { LivepeerPlaybackInfo } from "@livepeer/react/external";
import type { PlaybackEvent } from "@livepeer/core/media";

type AccessLevel = "public" | "authenticated" | "owner-only" | "collector-only";

interface LivepeerPlayerProps {
  playbackId: string;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  accessLevel?: AccessLevel;
}

export function LivepeerPlayer({
  playbackId,
  projectionId,
  masterId,
  canonicalStateId,
}: LivepeerPlayerProps) {
  const id = useId();
  const sessionRef = useRef<string | null>(null);
  if (sessionRef.current === null) sessionRef.current = id;

  const [playbackInfo, setPlaybackInfo] = useState<LivepeerPlaybackInfo | null>(null);

  useEffect(() => {
    fetch(`/api/livepeer/playback/${playbackId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlaybackInfo(data))
      .catch(() => null);
  }, [playbackId]);

  const src = getSrc(playbackInfo);

  const handlePlaybackEvents = useCallback(
    async (events: PlaybackEvent[]) => {
      for (const event of events) {
        const signalType = mapEventToSignalType(event);
        if (!signalType) continue;
        await fetch("/api/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectionId,
            masterId,
            canonicalStateId,
            signalType,
            sessionRef: sessionRef.current!,
          }),
        });
      }
    },
    [projectionId, masterId, canonicalStateId]
  );

  return (
    <Player.Root src={src} onPlaybackEvents={handlePlaybackEvents}>
      <Player.Container style={{ width: "100%", aspectRatio: "16/9", background: "#000" }}>
        <Player.Video style={{ width: "100%", height: "100%" }} />
        <Player.Controls>
          <Player.PlayPauseTrigger />
          <Player.MuteTrigger />
          <Player.Time />
          <Player.Seek />
          <Player.FullscreenTrigger />
        </Player.Controls>
        <Player.LoadingIndicator />
        <Player.ErrorIndicator matcher="all" />
      </Player.Container>
    </Player.Root>
  );
}

function mapEventToSignalType(
  event: PlaybackEvent
): "play" | "pause" | "complete" | null {
  const type = (event as { type?: string }).type;
  if (type === "play") return "play";
  if (type === "pause") return "pause";
  if (type === "ended") return "complete";
  return null;
}

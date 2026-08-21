"use client";

import { LivepeerPlayer } from "@/components/player/livepeer-player";

export type ProjectionMedia = {
  binding_type: string;
  access_level: string;
  delivery_format: string;
  playback_id: string | null;
  is_placeholder: boolean;
  start_ms: number | null;
  end_ms: number | null;
};

type Props = {
  media: ProjectionMedia | null;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
};

export default function ProjectionMediaPlayer({ media, projectionId, masterId, canonicalStateId }: Props) {
  if (!media || media.is_placeholder || !media.playback_id) {
    return (
      <div className="flex items-center justify-center w-full aspect-video bg-black">
        <div className="text-center space-y-2 px-4">
          <p className="text-white/40 text-sm">Media pending</p>
          <p className="text-white/20 text-xs">
            An authorised media asset has not yet been attached to this projection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LivepeerPlayer
      playbackId={media.playback_id}
      projectionId={projectionId}
      masterId={masterId}
      canonicalStateId={canonicalStateId}
      startMs={media.start_ms}
      endMs={media.end_ms}
    />
  );
}

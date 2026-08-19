"use client";

import { LivepeerPlayer } from "@/components/player/livepeer-player";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";

type Props = {
  media: WorldData["media"];
  projection: WorldData["projection"];
  master: WorldData["master"];
  canonicalState: WorldData["canonical_state"];
};

export default function WorldMedia({ media, projection, master, canonicalState }: Props) {
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
      projectionId={projection.projection_id}
      masterId={master.master_id}
      canonicalStateId={canonicalState.canonical_state_id}
    />
  );
}

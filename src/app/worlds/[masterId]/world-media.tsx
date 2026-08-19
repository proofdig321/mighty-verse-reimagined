"use client";

import ProjectionMediaPlayer from "@/components/player/projection-media-player";
import type { WorldData } from "@/app/api/worlds/[masterId]/route";

type Props = {
  media: WorldData["media"];
  projection: WorldData["projection"];
  master: WorldData["master"];
  canonicalState: WorldData["canonical_state"];
};

export default function WorldMedia({ media, projection, master, canonicalState }: Props) {
  return (
    <ProjectionMediaPlayer
      media={media}
      projectionId={projection.projection_id}
      masterId={master.master_id}
      canonicalStateId={canonicalState.canonical_state_id}
    />
  );
}

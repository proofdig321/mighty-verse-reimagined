"use client";

import SceneDeck from "@/components/scene-deck";

type SceneItem = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
  playback_id?: string | null;
};

type Props = { scenes: SceneItem[] };

export default function SceneDeckClient({ scenes }: Props) {
  return (
    <SceneDeck
      scenes={scenes.map((scene) => ({
        id: scene.master_id,
        title: scene.title,
        href: scene.projection_id ? `/moments/${scene.projection_id}` : undefined,
        playbackId: scene.playback_id,
      }))}
    />
  );
}

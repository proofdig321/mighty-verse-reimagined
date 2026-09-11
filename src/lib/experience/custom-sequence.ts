/**
 * Public Scene Deck custom sequence.
 * Presentation-only. Does not write sort_order, bindings, or user_deck rows.
 * Playback uses the existing Experience Editor TimelinePlayer.
 */

import type { PlaybackSegment } from "./playback";

export type CustomSequenceScene = {
  id: string;
  title: string | null;
  playbackId?: string | null;
  provider?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  projectionId?: string | null;
};

export type CustomSequenceItem = {
  slotId: string;
  sceneId: string;
  title: string;
  thumbnailUrl: string | null;
  startMs: number | null;
  endMs: number | null;
  playbackId: string | null;
  provider: string | null;
  projectionId: string | null;
};

export function sequenceThumbnailUrl(scene: CustomSequenceScene): string | null {
  if (!scene.playbackId) return null;
  const timeSec = scene.startMs != null ? Math.floor(scene.startMs / 1000) : 0;
  if ((scene.provider ?? "mux") === "mux") {
    return `https://image.mux.com/${scene.playbackId}/thumbnail.jpg?time=${timeSec}`;
  }
  return null;
}

export function addToCustomSequence(
  current: CustomSequenceItem[],
  scene: CustomSequenceScene,
): CustomSequenceItem[] {
  if (current.some((item) => item.sceneId === scene.id)) return current;
  return [
    ...current,
    {
      slotId: scene.id,
      sceneId: scene.id,
      title: scene.title?.trim() || "Scene",
      thumbnailUrl: sequenceThumbnailUrl(scene),
      startMs: scene.startMs ?? null,
      endMs: scene.endMs ?? null,
      playbackId: scene.playbackId ?? null,
      provider: scene.provider ?? null,
      projectionId: scene.projectionId ?? null,
    },
  ];
}

export function removeCustomSequenceSlot(
  current: CustomSequenceItem[],
  slotId: string,
): CustomSequenceItem[] {
  return current.filter((item) => item.slotId !== slotId);
}

export function clearCustomSequence(): CustomSequenceItem[] {
  return [];
}

export function sequenceToPlaybackSegments(items: CustomSequenceItem[]): PlaybackSegment[] {
  return items
    .filter((item): item is CustomSequenceItem & { playbackId: string; startMs: number; endMs: number } =>
      Boolean(item.playbackId) && item.startMs != null && item.endMs != null,
    )
    .map((item) => ({
      projectionId: item.projectionId || item.sceneId,
      title: item.title,
      playbackId: item.playbackId,
      provider: item.provider,
      startMs: item.startMs,
      endMs: item.endMs,
    }));
}

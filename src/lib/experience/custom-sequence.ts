/**
 * Public Scene Deck custom sequence.
 * Presentation-only. Does not write sort_order, bindings, or user_deck rows.
 */

export type CustomSequenceScene = {
  id: string;
  title: string | null;
  playbackId?: string | null;
  provider?: string | null;
  startMs?: number | null;
};

export type CustomSequenceItem = {
  slotId: string;
  sceneId: string;
  title: string;
  thumbnailUrl: string | null;
  startMs: number | null;
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

/**
 * Playback segments for the restored Experience Editor timeline player.
 * Public Scene Deck custom sequences reuse this shape. They do not write
 * canonical sort_order or user_deck rows.
 */

export type PlaybackSegment = {
  projectionId: string;
  title: string | null;
  playbackId: string;
  hlsUrl?: string | null;
  provider?: string | null;
  startMs: number;
  endMs: number;
};

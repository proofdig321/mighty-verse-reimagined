/** A canonical Scene available in the library */
export type LibraryScene = {
  masterId: string;
  projectionId: string;
  title: string | null;
  muralTitle: string | null;
  playbackId: string | null;
  startMs: number | null;
  endMs: number | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
};

/** An item the user has placed on their assembly canvas */
export type AssemblyItem = {
  /** Unique key within the assembly (not the DB id — allows same scene twice) */
  key: string;
  projectionId: string;
  title: string | null;
  thumbnailUrl: string | null;
  playbackId: string | null;
  startMs: number | null;
  endMs: number | null;
  durationSec: number | null;
};

/** A resolved playback segment for the timeline player */
export type PlaybackSegment = {
  projectionId: string;
  title: string | null;
  playbackId: string;
  startMs: number;
  endMs: number;
};

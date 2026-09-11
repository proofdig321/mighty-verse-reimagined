export type { PlaybackSegment } from "@/lib/experience/playback";

/** A canonical Scene available in the library */
export type LibraryScene = {
  masterId: string;
  projectionId: string;
  title: string | null;
  muralTitle: string | null;
  playbackId: string | null;
  /** Provider name: "mux" | "livepeer" | null */
  provider: string | null;
  /** Full HLS endpoint URL (for Mux). Null for Livepeer. */
  hlsUrl: string | null;
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
  provider: string | null;
  hlsUrl: string | null;
  startMs: number | null;
  endMs: number | null;
  durationSec: number | null;
};

"use client";

import { LivepeerPlayer } from "@/components/player/livepeer-player";
import { MuxPlayer } from "@/components/player/mux-player";
import type { MediaPlaybackSource } from "@/lib/media/providers/interface";

export type ProjectionMedia = {
  binding_type: string;
  access_level: string;
  delivery_format: string;
  playback_id: string | null;
  /** Provider name: "mux" | "livepeer" | null */
  provider: string | null;
  /** Normalized media class: "audio" | "video" | "image" | "other" | null */
  media_class: string | null;
  /** Full HLS endpoint URL (for Mux). Null for Livepeer (resolved via proxy). */
  endpoint_ref: string | null;
  is_placeholder: boolean;
  start_ms: number | null;
  end_ms: number | null;
};

type Props = {
  media: ProjectionMedia | null;
  projectionId: string;
  masterId: string;
  canonicalStateId: string;
  seekToSeconds?: number | null;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
};

export default function ProjectionMediaPlayer({
  media,
  projectionId,
  masterId,
  canonicalStateId,
  seekToSeconds,
  onTimeUpdate,
  onDurationChange,
}: Props) {
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

  const provider = media.provider ?? "livepeer";
  const mediaClass = (media.media_class ?? "video") as "audio" | "video" | "image" | "other";

  // Mux: use MuxPlayer with provider-neutral MediaPlaybackSource
  if (provider === "mux" && media.endpoint_ref) {
    const source: MediaPlaybackSource = {
      provider: "mux",
      mediaClass: mediaClass === "audio" || mediaClass === "video" ? mediaClass : "video",
      protocol: "hls",
      endpoint: media.endpoint_ref,
      playbackId: media.playback_id,
    };
    return (
      <MuxPlayer
        source={source}
        projectionId={projectionId}
        masterId={masterId}
        canonicalStateId={canonicalStateId}
        startMs={media.start_ms}
        endMs={media.end_ms}
        seekToSeconds={seekToSeconds}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
      />
    );
  }

  // Livepeer: use existing LivepeerPlayer (historical assets)
  return (
    <LivepeerPlayer
      playbackId={media.playback_id}
      projectionId={projectionId}
      masterId={masterId}
      canonicalStateId={canonicalStateId}
      startMs={media.start_ms}
      endMs={media.end_ms}
      seekToSeconds={seekToSeconds}
      onTimeUpdate={onTimeUpdate}
      onDurationChange={onDurationChange}
    />
  );
}

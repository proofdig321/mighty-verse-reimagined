const MUX_IMAGE_BASE = "https://image.mux.com";

/**
 * Mux representative poster (no `time`).
 * `thumbnail.jpg?time=0` is the first decoded frame and can be literally black.
 */
export function muxPosterUrl(playbackId: string, width?: number): string {
  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  const query = params.toString();
  return query
    ? `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.jpg?${query}`
    : `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.jpg`;
}

/**
 * Returns a Mux thumbnail URL for a given playback ID.
 * Omit `time` when timeSec <= 0 so Mux chooses a representative frame.
 */
export function muxThumbnailUrl(playbackId: string, timeSec = 0, width?: number): string {
  if (!Number.isFinite(timeSec) || timeSec <= 0) {
    return muxPosterUrl(playbackId, width);
  }
  const params = new URLSearchParams({ time: String(timeSec) });
  if (width) params.set("width", String(width));
  return `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.jpg?${params}`;
}

/** Playback id from a Mux playback id, HLS endpoint, or image URL. */
export function muxPlaybackIdFromRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hls = trimmed.match(/stream\.mux\.com\/([^/.]+)/i);
  if (hls?.[1]) return hls[1];
  const image = trimmed.match(/image\.mux\.com\/([^/.]+)/i);
  if (image?.[1]) return image[1];
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("seed:")) return null;
  return trimmed;
}

/** Representative Mux still from a playback id or HLS endpoint. */
export function muxStillFromPlayback(
  playbackOrEndpoint: string | null | undefined,
  timeSec = 0,
  width?: number,
): string | null {
  const playbackId = muxPlaybackIdFromRef(playbackOrEndpoint);
  if (!playbackId) return null;
  return muxThumbnailUrl(playbackId, timeSec, width);
}

/**
 * Returns a provider-aware thumbnail URL from a storage_ref.
 * Only Mux is supported. Unknown/null provider returns null.
 */
export function providerThumbnailUrl(
  provider: string | null | undefined,
  storageRef: string,
  opts: { timeSec?: number; width?: number } = {}
): string | null {
  if (storageRef.startsWith("https://")) return storageRef;
  if (provider === "mux" || provider === "curated-reference") {
    return muxThumbnailUrl(storageRef, opts.timeSec ?? 0, opts.width);
  }
  return null;
}

/**
 * Resolve the best thumbnail URL for a scene/moment.
 * Priority: custom artwork_asset_id storage_ref > Mux thumbnail > null
 */
export function resolveThumbnail(opts: {
  playbackId: string | null;
  startMs: number | null;
  artworkStorageRef?: string | null;
  provider?: string | null;
}): string | null {
  if (opts.artworkStorageRef && !opts.artworkStorageRef.startsWith("seed:placeholder:")) {
    return opts.artworkStorageRef;
  }
  if (!opts.playbackId) return null;
  if (opts.provider === "mux") {
    const timeSec = opts.startMs != null ? Math.floor(opts.startMs / 1000) : 0;
    return muxThumbnailUrl(opts.playbackId, timeSec);
  }
  return null;
}

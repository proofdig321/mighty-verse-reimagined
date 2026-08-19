import type { Asset } from "livepeer/models/components";

/** Fields mapped from a Livepeer Asset to media_asset columns */
export type LivepeerAssetMapping = {
  /** Livepeer asset id — stored as storage_ref on media_asset */
  livepeerAssetId: string;
  /** SHA-256 hash from Livepeer hash array, or empty string if unavailable */
  integrityHash: string;
  /** video/mp4, application/vnd.apple.mpegurl, etc. */
  format: string | null;
  /** WxH string e.g. "1920x1080", null if unavailable */
  resolution: string | null;
  /** Duration in milliseconds, null if unavailable */
  durationMs: number | null;
  /** HLS playback URL — stored as endpoint_ref on delivery_variant */
  hlsPlaybackUrl: string | null;
};

export function mapLivepeerAsset(asset: Asset): LivepeerAssetMapping {
  const hashEntry = asset.hash?.find((h) => h.algorithm === "sha256");
  const videoSpec = asset.videoSpec;
  const track = videoSpec?.tracks?.find((t) => t.type === "video");

  return {
    livepeerAssetId: asset.id,
    integrityHash: hashEntry?.hash ?? `livepeer:${asset.id}`,
    format: videoSpec?.format ?? null,
    resolution:
      track?.width && track?.height
        ? `${track.width}x${track.height}`
        : null,
    durationMs: videoSpec?.duration ? Math.round(videoSpec.duration * 1000) : null,
    hlsPlaybackUrl: asset.playbackUrl ?? null,
  };
}

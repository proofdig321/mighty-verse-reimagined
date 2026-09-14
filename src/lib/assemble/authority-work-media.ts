/**
 * Authority work records play the bound Mux (or Livepeer) asset.
 * MEDIA ≠ CREATIVE WORK — storage_ref is delivery, not identity.
 */

const MUX_STREAM_BASE = "https://stream.mux.com";

export function muxHlsEndpoint(playbackId: string): string {
  return `${MUX_STREAM_BASE}/${playbackId}.m3u8`;
}

export type AuthorityBoundMedia = {
  binding_type: string;
  access_level: string;
  start_ms: number | null;
  end_ms: number | null;
  media_asset: {
    storage_ref: string | null;
    asset_type: string | null;
    provider?: string | null;
  } | null;
};

export type AuthorityProjectionMedia = {
  binding_type: string;
  access_level: string;
  delivery_format: string;
  playback_id: string;
  provider: string;
  media_class: "audio" | "video";
  endpoint_ref: string | null;
  is_placeholder: false;
  start_ms: number | null;
  end_ms: number | null;
};

export function isPlayableBoundMedia(binding: AuthorityBoundMedia | null | undefined): boolean {
  const storageRef = binding?.media_asset?.storage_ref;
  return Boolean(storageRef && !storageRef.startsWith("seed:placeholder:"));
}

export function toAuthorityProjectionMedia(
  binding: AuthorityBoundMedia | null | undefined,
): AuthorityProjectionMedia | null {
  if (!isPlayableBoundMedia(binding) || !binding?.media_asset?.storage_ref) return null;
  const playbackId = binding.media_asset.storage_ref;
  const provider = binding.media_asset.provider ?? "mux";
  const mediaClass = binding.media_asset.asset_type?.startsWith("audio/") ? "audio" : "video";
  return {
    binding_type: binding.binding_type,
    access_level: binding.access_level,
    delivery_format: "hls",
    playback_id: playbackId,
    provider,
    media_class: mediaClass,
    endpoint_ref: provider === "mux" ? muxHlsEndpoint(playbackId) : null,
    is_placeholder: false,
    start_ms: binding.start_ms,
    end_ms: binding.end_ms,
  };
}

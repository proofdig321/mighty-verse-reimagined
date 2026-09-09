/**
 * Mux provider adapter.
 *
 * All Mux-specific operations are contained here.
 * The domain layer calls the MediaProvider interface — never this module directly.
 *
 * Server-side only. Never import from client components.
 */
import type { MediaProvider, MediaClass, MediaPlaybackSource, ProviderAsset, DirectUploadResult } from "../interface";
import { getMuxClient } from "./client";

export type DirectUploadStatus = {
  providerUploadId: string;
  status: string;
  assetId: string | null;
};

/** Mux HLS base URL. Owned by the adapter — not scattered through the application. */
const MUX_STREAM_BASE = "https://stream.mux.com";

/**
 * Derive normalized media class from Mux asset tracks.
 * A Mux asset with no video track is audio-only.
 */
function deriveMediaClass(tracks?: Array<{ type?: string }> | null): MediaClass {
  if (!tracks || tracks.length === 0) return "other";
  const hasVideo = tracks.some((t) => t.type === "video");
  const hasAudio = tracks.some((t) => t.type === "audio");
  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  return "other";
}

/**
 * Select the public playback ID from a Mux asset's playback_ids array.
 * Policy: use the first public playback ID.
 * Future signed/private playback can be added here without changing the domain model.
 */
function selectPlaybackId(
  playbackIds?: Array<{ id: string; policy?: string }> | null
): string | null {
  if (!playbackIds || playbackIds.length === 0) return null;
  const pub = playbackIds.find((p) => p.policy === "public" || p.policy === "signed");
  return pub?.id ?? playbackIds[0]?.id ?? null;
}

/**
 * Map a raw Mux asset API response to the normalized ProviderAsset shape.
 */
export function mapMuxAsset(asset: any): ProviderAsset {
  const tracks = asset.tracks ?? null;
  const mediaClass = deriveMediaClass(tracks);
  const playbackId = selectPlaybackId(asset.playback_ids);

  // Resolution: use max_stored_resolution for video, null for audio
  let resolution: string | null = null;
  if (mediaClass === "video") {
    const videoTrack = tracks?.find((t: { type?: string; width?: number; height?: number }) => t.type === "video");
    if (videoTrack?.width && videoTrack?.height) {
      resolution = `${videoTrack.width}x${videoTrack.height}`;
    } else if (asset.max_stored_resolution) {
      resolution = asset.max_stored_resolution;
    }
  }

  // Duration: Mux reports in seconds (float)
  const durationMs = asset.duration ? Math.round(asset.duration * 1000) : null;

  // Format: derive from media class since Mux doesn't expose a simple MIME type
  const format = mediaClass === "video" ? "video/mp4" : mediaClass === "audio" ? "audio/mpeg" : null;

  return {
    providerAssetId: asset.id,
    playbackId: playbackId ?? "",
    mediaClass,
    format,
    resolution,
    durationMs,
    integrityHash: `mux:${asset.id}`,
  };
}

export class MuxAdapter implements MediaProvider {
  async createDirectUpload(params: {
    name: string;
    passthrough: string;
    corsOrigin: string;
  }): Promise<DirectUploadResult> {
    const mux = getMuxClient();
    const upload = await mux.video.uploads.create({
      cors_origin: params.corsOrigin,
      new_asset_settings: {
        passthrough: params.passthrough,
        // HLS only — no static renditions in initial implementation
        playback_policy: ["public"],
      },
    });

    return {
      uploadUrl: upload.url ?? "",
      providerUploadId: upload.id,
    };
  }

  async retrieveDirectUpload(providerUploadId: string): Promise<DirectUploadStatus | null> {
    try {
      const mux = getMuxClient();
      const upload = await mux.video.uploads.retrieve(providerUploadId);
      return {
        providerUploadId: upload.id,
        status: typeof upload.status === "string" ? upload.status : "waiting",
        assetId: upload.asset_id ?? null,
      };
    } catch {
      return null;
    }
  }

  async getAsset(providerAssetId: string): Promise<ProviderAsset | null> {
    try {
      const mux = getMuxClient();
      const asset = await mux.video.assets.retrieve(providerAssetId);
      return mapMuxAsset(asset);
    } catch {
      return null;
    }
  }

  /**
   * Ingest a production video URL into Mux. Mux is delivery infrastructure,
   * not the creative executor. Do not call this until an executor returns a result.
   */
  async createAssetFromUrl(params: {
    url: string;
    passthrough?: string;
  }): Promise<ProviderAsset> {
    const mux = getMuxClient();
    const asset = await mux.video.assets.create({
      inputs: [{ url: params.url }],
      playback_policies: ["public"],
      passthrough: params.passthrough,
    });
    return mapMuxAsset(asset);
  }

  buildPlaybackSource(playbackId: string, mediaClass: MediaClass): MediaPlaybackSource {
    return {
      provider: "mux",
      mediaClass,
      protocol: "hls",
      endpoint: `${MUX_STREAM_BASE}/${playbackId}.m3u8`,
      playbackId,
    };
  }
}

export const muxAdapter = new MuxAdapter();

/**
 * Verify a Mux webhook signature.
 * Must be called with the raw request body (not parsed JSON).
 * Returns the parsed payload if valid, throws if invalid.
 */
export function verifyMuxWebhook(
  rawBody: string,
  signature: string,
  secret: string
): any {
  const mux = getMuxClient();
  return mux.webhooks.unwrap(rawBody, { "mux-signature": signature }, secret);
}

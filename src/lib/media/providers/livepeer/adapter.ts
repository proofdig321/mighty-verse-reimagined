/**
 * Livepeer provider adapter.
 *
 * Wraps existing Livepeer operations behind the MediaProvider interface.
 * Historical Livepeer records remain untouched.
 * New uploads use the Mux adapter.
 *
 * Server-side only.
 */
import type { MediaProvider, MediaClass, MediaPlaybackSource, ProviderAsset, DirectUploadResult } from "../interface";
import { livepeer } from "@/lib/livepeer/client";
import { mapLivepeerAsset } from "@/lib/livepeer/types";

export class LivepeerAdapter implements MediaProvider {
  async createDirectUpload(_params: {
    name: string;
    passthrough: string;
    corsOrigin: string;
  }): Promise<DirectUploadResult> {
    // Livepeer upload creation — kept for reference but new uploads use Mux.
    const result = await livepeer.asset.create({ name: _params.name });
    if (!result.data) throw new Error("Failed to create Livepeer upload session");
    return {
      uploadUrl: result.data.url ?? "",
      providerUploadId: result.data.asset.id,
    };
  }

  async getAsset(providerAssetId: string): Promise<ProviderAsset | null> {
    try {
      const response = await livepeer.asset.get(providerAssetId);
      if (!response.asset) return null;
      const mapped = mapLivepeerAsset(response.asset);
      return {
        providerAssetId: mapped.livepeerAssetId,
        playbackId: response.asset.playbackId ?? "",
        mediaClass: "video", // Historical Livepeer assets are video animations
        format: mapped.format,
        resolution: mapped.resolution,
        durationMs: mapped.durationMs,
        integrityHash: mapped.integrityHash,
      };
    } catch {
      return null;
    }
  }

  buildPlaybackSource(playbackId: string, mediaClass: MediaClass): MediaPlaybackSource {
    // Livepeer playback requires the proxy route to resolve the HLS URL.
    // The endpoint here is the proxy path; the player fetches the actual HLS URL from it.
    return {
      provider: "livepeer",
      mediaClass,
      protocol: "hls",
      endpoint: `/api/livepeer/playback/${playbackId}`,
      playbackId,
    };
  }
}

export const livepeerAdapter = new LivepeerAdapter();

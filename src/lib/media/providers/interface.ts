/**
 * Mighty Verse Media Provider Interface
 *
 * The domain layer calls this interface. Provider-specific mechanics
 * (Mux SDK calls, Livepeer SDK calls) live inside adapters.
 *
 * The domain must not contain scattered if (provider === "mux") branches.
 */

/** Normalized, provider-independent media classification. */
export type MediaClass = "audio" | "video" | "image" | "other";

/**
 * Provider-neutral playback source.
 * The player receives this and does not need to know which provider produced it.
 */
export type MediaPlaybackSource = {
  provider: "mux" | "livepeer";
  mediaClass: MediaClass;
  protocol: "hls";
  /** Full HLS URL ready for the player. */
  endpoint: string;
  /** Provider playback identifier (Mux playback_id or Livepeer playbackId). */
  playbackId: string;
};

/**
 * Normalized provider asset representation.
 * Returned by getAsset() and mapAsset() — provider-specific fields are
 * translated into this canonical shape before touching domain records.
 */
export type ProviderAsset = {
  /** Provider asset identifier (Mux asset.id, Livepeer asset.id). */
  providerAssetId: string;
  /** Provider playback identifier (Mux playback_id, Livepeer playbackId). */
  playbackId: string;
  /** Normalized media class derived from provider track data. */
  mediaClass: MediaClass;
  /** Provider-reported format/container string. May be null. */
  format: string | null;
  /** WxH string e.g. "1920x1080". Null for audio-only assets. */
  resolution: string | null;
  /** Duration in milliseconds. Null if unavailable. */
  durationMs: number | null;
  /**
   * Content integrity reference.
   * For Mux: "mux:{assetId}" (Mux does not expose SHA-256 hashes directly).
   * For Livepeer: SHA-256 hash from asset.hash array, or "livepeer:{assetId}".
   */
  integrityHash: string;
};

/**
 * Result of creating a Direct Upload.
 * The browser receives uploadUrl only — never provider credentials.
 */
export type DirectUploadResult = {
  /** Authenticated URL the browser PUTs the file to directly. */
  uploadUrl: string;
  /** Provider upload identifier (Mux upload.id). Used for webhook correlation. */
  providerUploadId: string;
};

/**
 * Media provider interface.
 * Implemented by MuxAdapter and LivepeerAdapter.
 *
 * Note: webhook processing is intentionally NOT part of this interface.
 * Webhooks are provider-specific and belong in the provider's webhook handler.
 * The interface covers operations the domain layer needs to initiate.
 */
export interface MediaProvider {
  /**
   * Create an authenticated Direct Upload URL.
   * The browser uploads directly to the provider — media never passes through
   * the application server.
   *
   * @param name     Human-readable asset name (filename).
   * @param passthrough  Mighty Verse session_id — carried through the provider
   *                     lifecycle and returned on every webhook event.
   * @param corsOrigin   Allowed origin for browser upload. Must not be "*" in production.
   */
  createDirectUpload(params: {
    name: string;
    passthrough: string;
    corsOrigin: string;
  }): Promise<DirectUploadResult>;

  /**
   * Fetch a provider asset by its provider asset ID.
   * Used as a fallback when webhook payload is insufficient for reconciliation.
   */
  getAsset(providerAssetId: string): Promise<ProviderAsset | null>;

  /**
   * Build a playback source from a stored provider asset identity.
   * Called by the player layer to construct the HLS endpoint.
   *
   * @param playbackId  The stored storage_ref (Mux playback_id or Livepeer playbackId).
   * @param mediaClass  The stored media_class on the media_asset.
   */
  buildPlaybackSource(playbackId: string, mediaClass: MediaClass): MediaPlaybackSource;
}

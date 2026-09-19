/**
 * Mighty Verse — Depth Provider Registry
 *
 * Selects the active depth generation provider based on the DEPTH_PROVIDER
 * environment variable. Defaults to "modal-vda" when not set.
 *
 * Supported values:
 *   modal-vda   — Video Depth Anything Small via Modal GPU worker (default)
 *   replicate   — DA2 Small via Replicate (legacy, image-based, not recommended)
 *
 * The active provider is resolved once at module load time.
 * Provider-specific credentials are validated inside each adapter's isConfigured().
 *
 * SENTINEL BOUNDARY: Registry does not interact with Sentinel.
 */

import type { DepthProvider } from "./provider";
import { modalVDAProvider } from "./providers/modal/adapter";
import { replicateDepthProvider } from "./providers/replicate/adapter";

export type DepthProviderName = "modal-vda" | "replicate";

const PROVIDER_MAP: Record<DepthProviderName, DepthProvider> = {
  "modal-vda": modalVDAProvider,
  "replicate": replicateDepthProvider,
};

/**
 * Returns the active depth provider.
 * Reads DEPTH_PROVIDER env var; defaults to "modal-vda".
 */
export function getActiveDepthProvider(): DepthProvider {
  const name = (process.env.DEPTH_PROVIDER?.trim() ?? "modal-vda") as DepthProviderName;
  return PROVIDER_MAP[name] ?? modalVDAProvider;
}

/**
 * Returns the active provider name string.
 */
export function getActiveDepthProviderName(): DepthProviderName {
  const name = (process.env.DEPTH_PROVIDER?.trim() ?? "modal-vda") as DepthProviderName;
  return name in PROVIDER_MAP ? name : "modal-vda";
}

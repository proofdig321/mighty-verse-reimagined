/**
 * Provider registry.
 *
 * Mux is the only video delivery provider.
 * All other domain code calls the MediaProvider interface.
 */
import type { MediaProvider } from "./interface";
import { muxAdapter } from "./mux/adapter";

export function getProvider(provider: string): MediaProvider {
  if (provider === "mux") return muxAdapter;
  throw new Error(`Unknown media provider: ${provider}`);
}

/** The current default provider for new uploads. */
export const DEFAULT_PROVIDER = "mux";

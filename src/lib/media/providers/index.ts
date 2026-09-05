/**
 * Provider registry.
 *
 * Returns the correct MediaProvider adapter for a given provider name.
 * This is the only place in the domain that branches on provider identity.
 * All other domain code calls the MediaProvider interface.
 */
import type { MediaProvider } from "./interface";
import { muxAdapter } from "./mux/adapter";
import { livepeerAdapter } from "./livepeer/adapter";

export function getProvider(provider: string): MediaProvider {
  if (provider === "mux") return muxAdapter;
  if (provider === "livepeer") return livepeerAdapter;
  throw new Error(`Unknown media provider: ${provider}`);
}

/** The current default provider for new uploads. */
export const DEFAULT_PROVIDER = "mux";

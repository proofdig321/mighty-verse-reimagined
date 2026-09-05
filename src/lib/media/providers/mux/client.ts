/**
 * Mux SDK client — server-side only.
 *
 * MUX_TOKEN_ID and MUX_TOKEN_SECRET must never be exposed to the browser.
 * This module must never be imported from client components.
 */
import Mux from "@mux/mux-node";

export function getMuxClient(): Mux {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set");
  }
  return new Mux({ tokenId, tokenSecret });
}

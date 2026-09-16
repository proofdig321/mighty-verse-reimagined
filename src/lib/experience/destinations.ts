/**
 * Public Experience destinations. Navigation labels only — not a new ontology.
 *
 * `/worlds/{id}` is the Universe 2.5D destination.
 * `/worlds/{id}/holographic` is the Holographic Experience.
 */
export const ENTER_2_5D_LABEL = "Enter 2.5D";
export const HOLOGRAPHIC_EXPERIENCE_LABEL = "Holographic Experience";

export function publicWorldHref(universeId: string): string {
  return `/worlds/${universeId}`;
}

export function publicHolographicHref(universeId: string): string {
  return `/worlds/${universeId}/holographic`;
}

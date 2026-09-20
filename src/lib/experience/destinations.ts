/**
 * Public Experience destinations. Navigation labels only — not a new ontology.
 *
 * `/worlds/{id}` is the Universe editorial/discovery layer.
 * `/worlds/{id}/2.5d` is the genuine lightweight 2.5D spatial presentation.
 * `/worlds/{id}/holographic` is the full Holographic Experience.
 */
export const UNIVERSE_LABEL = "Universe";
export const ENTER_2_5D_LABEL = "2.5D";
export const HOLOGRAPHIC_EXPERIENCE_LABEL = "Holographic Experience";

export function publicWorldHref(universeId: string): string {
  return `/worlds/${universeId}`;
}

export function public2_5dHref(universeId: string): string {
  return `/worlds/${universeId}/2.5d`;
}

export function publicHolographicHref(universeId: string): string {
  return `/worlds/${universeId}/holographic`;
}

/**
 * Home hero configuration.
 *
 * Controls what the public home hero displays. The featured universe is
 * resolved at runtime from discovery data — `featuredUniverseId` pins a
 * specific universe as the hero background; null means "first with video".
 *
 * Persistence: currently static. A future DB row (site_config) can replace
 * this without changing the consumer API — just swap the export for an async
 * loader and update the home page to await it.
 */
export type HeroConfig = {
  /** Short uppercase eyebrow line above the headline */
  eyebrow: string;
  /** Main headline — plain string, no JSX */
  headline: string;
  /** Supporting description below the headline */
  description: string;
  /** Pin a specific media_asset asset_id as the hero background video. null = auto (first playable video) */
  heroMediaId: string | null;
  /** Text colour scheme over the hero background — light = white text (dark video), dark = dark text (light video) */
  textScheme: "light" | "dark";
  /** Show "Watch Trailer" CTA when a video is available */
  showTrailerCta: boolean;
};

export const heroConfig: HeroConfig = {
  eyebrow: "A living catalogue of Universes",
  headline: "Every Song is a Universe. Every Moment is a Legend.",
  description:
    "Discover a Universe, reveal its Mural, Scenes, and Creative Moments, then enter 2.5D or Holographic Experience.",
  heroMediaId: null,
  textScheme: "light",
  showTrailerCta: true,
};

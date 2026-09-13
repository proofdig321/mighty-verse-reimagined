/**
 * Visible audience product navigation.
 *
 * Discover → Reveal → Experience. Operations stay on the gated dashboard.
 */

export type ProductNavLink = {
  href: string;
  label: string;
  surface?: "home" | "universes" | "murals" | "scenes" | "moments";
};

export const PUBLIC_PRODUCT_NAV: ProductNavLink[] = [
  { href: "/", label: "Home", surface: "home" },
  { href: "/universes", label: "Universes", surface: "universes" },
  { href: "/murals", label: "Murals", surface: "murals" },
  { href: "/scenes", label: "Scenes", surface: "scenes" },
  { href: "/moments", label: "Creative Moments", surface: "moments" },
];

export const EXPERIENCE_JOURNEY_HREF = "/universes?intent=experience";
export const CREATIVE_STUDIO_HREF = "/studio";
export const DASHBOARD_HREF = "/authority";
export const AUDIENCE_STORYBOARD_HREF = "/storyboard";
export const AUDIENCE_HELP_HREF = "/help";
export const AUDIENCE_CONNECT_HREF = "/auth/sign-in";

/**
 * Visible audience product navigation.
 *
 * Operations live on the gated dashboard. These links are Discover → Reveal → Experience.
 */

export type ProductNavLink = {
  href: string;
  label: string;
  surface?: "home" | "universes" | "murals" | "scenes" | "moments" | "studio" | "gallery" | "storyboard" | "participants" | "help";
};

export const PUBLIC_PRODUCT_NAV: ProductNavLink[] = [
  { href: "/", label: "Home", surface: "home" },
  { href: "/universes", label: "Universes", surface: "universes" },
  { href: "/murals", label: "Murals", surface: "murals" },
  { href: "/scenes", label: "Scenes", surface: "scenes" },
  { href: "/moments", label: "Creative Moments", surface: "moments" },
  { href: "/gallery", label: "Gallery", surface: "gallery" },
  { href: "/storyboard", label: "Storyboard", surface: "storyboard" },
  { href: "/participants", label: "Participants", surface: "participants" },
  { href: "/studio", label: "Creative Studio", surface: "studio" },
];

export const EXPERIENCE_JOURNEY_HREF = "/universes?intent=experience";
export const CREATIVE_STUDIO_HREF = "/studio";
export const DASHBOARD_HREF = "/authority";
export const AUDIENCE_STORYBOARD_HREF = "/storyboard";
export const AUDIENCE_HELP_HREF = "/help";

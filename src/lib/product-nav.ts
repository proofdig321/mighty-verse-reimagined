/**
 * Visible public product navigation.
 *
 * Internal `/worlds/` routes remain. User-facing labels use the canonical
 * ontology. Creative Studio is mounted here so it is not a guessed URL.
 */

export type ProductNavLink = {
  href: string;
  label: string;
  surface: "home" | "universes" | "murals" | "scenes" | "moments" | "studio";
};

export const PUBLIC_PRODUCT_NAV: ProductNavLink[] = [
  { href: "/", label: "Home", surface: "home" },
  { href: "/universes", label: "Universes", surface: "universes" },
  { href: "/murals", label: "Murals", surface: "murals" },
  { href: "/scenes", label: "Scenes", surface: "scenes" },
  { href: "/moments", label: "Creative Moments", surface: "moments" },
  { href: "/authority/universes", label: "Creative Studio", surface: "studio" },
];

export const EXPERIENCE_JOURNEY_HREF = "/universes?intent=experience";
export const CREATIVE_STUDIO_HREF = "/authority/universes";
export const DASHBOARD_HREF = "/authority";

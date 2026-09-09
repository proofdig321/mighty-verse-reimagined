import type { UniverseAssembly, UniverseAssemblyScene } from "./types";

/**
 * Creative Studio workspaces hosted under `/authority/universes/[id]`.
 *
 * Each major creative activity is a child route, not a hash fragment on a
 * stacked ontology dump. Identity remains a dedicated child page, accessed
 * from Overview rather than the primary workspace nav.
 *
 * Scene identity, timing, canonical order, Scene ↔ Creative Moment presence,
 * and Sentinel-derived intelligence are authored on these surfaces.
 * Creative Moments are Universe-parented, not Mural-owned.
 * Sentinel remembers observations and proposes windows. It does not create Scenes.
 * Production plans are derived Scene-centric instructions, not a second ontology.
 * Scene Deck shuffle is not imported.
 */
export const CREATIVE_SUITE_SECTIONS = [
  { id: "overview", label: "Overview", path: "" },
  { id: "storyboard", label: "Storyboard", path: "storyboard" },
  { id: "scenes", label: "Scenes", path: "scenes" },
  { id: "production", label: "Production", path: "production" },
  { id: "preview", label: "2.5D", path: "preview" },
  { id: "experience", label: "Experience", path: "experience" },
] as const;

export type CreativeSuiteSectionId =
  | (typeof CREATIVE_SUITE_SECTIONS)[number]["id"]
  | "identity";

export type CreativeSuiteNavItem = {
  id: CreativeSuiteSectionId;
  label: string;
  href: string;
};

export type SuiteScene = UniverseAssemblyScene & {
  mural_id: string;
  mural_title: string | null;
};

export function suiteScenes(assembly: UniverseAssembly): SuiteScene[] {
  return assembly.murals.flatMap((mural) =>
    mural.scenes.map((scene) => ({
      ...scene,
      mural_id: mural.master_id,
      mural_title: mural.title,
    })),
  );
}

/** Preserve `?from=curate` (and any other query) when appending a child path. */
export function suiteChildHref(suiteHref: string, path = ""): string {
  const [base, query] = suiteHref.split("?");
  const href = path ? `${base.replace(/\/$/, "")}/${path}` : base;
  return query ? `${href}?${query}` : href;
}

export function suiteIdentityHref(suiteHref: string): string {
  return suiteChildHref(suiteHref, "identity");
}

/**
 * Legacy hash fragments from the stacked Studio page.
 * Mapped onto child workspaces so bookmarks and inspect links keep working.
 */
export const STUDIO_HASH_WORKSPACES: Record<string, { path: string; search?: Record<string, string> }> = {
  "universe-identity": { path: "identity" },
  "universe-source": { path: "" },
  "universe-mural": { path: "" },
  "universe-sentinel": { path: "storyboard", search: { source: "sentinel" } },
  "sentinel-storyboard": { path: "storyboard" },
  "sentinel-animation": { path: "storyboard", search: { source: "sentinel" } },
  "sentinel-proposals": { path: "storyboard", search: { source: "sentinel" } },
  "sentinel-authorise": { path: "storyboard", search: { source: "sentinel" } },
  "universe-production": { path: "production" },
  "universe-preview": { path: "preview" },
  "universe-scenes": { path: "scenes" },
  "universe-moments": { path: "scenes" },
  "universe-experience-continuation": { path: "experience" },
};

export function resolveStudioHash(hash: string): {
  path: string;
  search?: Record<string, string>;
  retainHash?: string;
} | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;
  const mapped = STUDIO_HASH_WORKSPACES[id];
  if (mapped) return mapped;
  if (id.startsWith("universe-scene-")) {
    return { path: `scenes/${id.slice("universe-scene-".length)}` };
  }
  if (id.startsWith("universe-moment-")) {
    return { path: "scenes", retainHash: id };
  }
  return null;
}

/** Authority and future public suites inject their own base path. */
export function creativeSuiteNavItems(suiteHref: string): CreativeSuiteNavItem[] {
  return CREATIVE_SUITE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    href: suiteChildHref(suiteHref, section.path),
  }));
}

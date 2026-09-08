import type { UniverseAssembly, UniverseAssemblyScene } from "./types";

/**
 * Creative Suite sections hosted by the Universe assembly surface.
 * Editors for Mural / Scenes / Creative Moments are later increments.
 * Creative Moments are Universe-parented, not Mural-owned.
 */
export const CREATIVE_SUITE_SECTIONS = [
  { id: "identity", label: "Identity", fragment: "universe-identity" },
  { id: "mural", label: "Mural", fragment: "universe-mural" },
  { id: "scenes", label: "Scenes", fragment: "universe-scenes" },
  { id: "moments", label: "Creative Moments", fragment: "universe-moments" },
] as const;

export type CreativeSuiteSectionId = (typeof CREATIVE_SUITE_SECTIONS)[number]["id"];

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

/** Authority and future public suites inject their own base path. */
export function creativeSuiteNavItems(
  suiteHref: string,
  current?: CreativeSuiteSectionId,
): CreativeSuiteNavItem[] {
  return CREATIVE_SUITE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    href:
      section.id === "identity" && current === "identity"
        ? `${suiteHref}/identity`
        : `${suiteHref}#${section.fragment}`,
  }));
}

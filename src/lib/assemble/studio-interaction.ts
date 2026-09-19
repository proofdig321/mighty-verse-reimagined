/**
 * Creative Studio interaction model.
 *
 * Context → Work → Directive sits on top of the existing Storyboard / Panel /
 * Sentinel / Reference / Generation ontology. It does not add a Shot table or
 * turn Experience into a Studio editor.
 */
export const STUDIO_INTERACTION_PHASES = [
  {
    id: "context",
    label: "Context",
    defaultTab: "sentinel",
    note: "Source, Universe association, and Sentinel evidence. Sentinel observes; it does not author creative meaning.",
  },
  {
    id: "work",
    label: "Storyboard",
    defaultTab: "script",
    note: "Storyboard, panels, and generated artifacts. Non-canonical until authorised through curation.",
  },
  {
    id: "directive",
    label: "Realization",
    defaultTab: "stills",
    note: "Creator directive, Generate Still, and Generate Motion. Separate from Sentinel observations.",
  },
] as const;

export type StudioInteractionPhaseId = (typeof STUDIO_INTERACTION_PHASES)[number]["id"];

const TAB_PHASE: Record<string, StudioInteractionPhaseId> = {
  sentinel: "context",
  references: "context",
  script: "work",
  panels: "work",
  assembly: "work",
  stills: "directive",
  motion: "directive",
  assist: "directive",
};

export function studioInteractionLabel(): string {
  return STUDIO_INTERACTION_PHASES.map((phase) => phase.label).join(" → ");
}

export function studioPhaseForTab(tab: string): (typeof STUDIO_INTERACTION_PHASES)[number] {
  const id = TAB_PHASE[tab] ?? "work";
  return STUDIO_INTERACTION_PHASES.find((phase) => phase.id === id) ?? STUDIO_INTERACTION_PHASES[1];
}

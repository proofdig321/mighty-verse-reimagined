/**
 * Storyboard progress is derived from live persisted state.
 * SCRIPT → PANELS → REFERENCES → STILLS → MOTION → ASSEMBLY
 */

export const STORYBOARD_PROGRESS_STEPS = [
  { id: "script", label: "Script" },
  { id: "panels", label: "Panels" },
  { id: "references", label: "References" },
  { id: "stills", label: "Stills" },
  { id: "motion", label: "Motion" },
  { id: "assembly", label: "Assembly" },
] as const;

/** Visible operator chain. Does not add a seventh progress step. */
export const STORYBOARD_OPERATOR_CHAIN = [
  "Source",
  "Sentinel",
  "Reference",
  "Transformation",
  "Still",
  "Motion",
  "Assembly",
] as const;

export function storyboardOperatorChainLabel(): string {
  return STORYBOARD_OPERATOR_CHAIN.join(" → ");
}

export type StoryboardProgressStepId = (typeof STORYBOARD_PROGRESS_STEPS)[number]["id"];

export type StoryboardProgressStep = {
  id: StoryboardProgressStepId;
  label: string;
  complete: boolean;
};

export type StoryboardProgress = {
  steps: StoryboardProgressStep[];
  completeCount: number;
  total: number;
};

const MOTION_TYPES = new Set(["animation", "clip", "motion", "animate-still", "first-last-frame", "reference-motion", "extend"]);
const ASSEMBLY_TYPES = new Set(["gif", "reel"]);

export function deriveStoryboardProgress(input: {
  script?: string | null;
  panelCount?: number;
  referenceStillCount?: number;
  artifactStillCount?: number;
  artifactTypes?: string[];
  jobKinds?: string[];
}): StoryboardProgress {
  const types = [...(input.artifactTypes ?? []), ...(input.jobKinds ?? [])];
  const scriptReady = Boolean(input.script?.trim());
  const panelsReady = (input.panelCount ?? 0) > 0;
  const referencesReady = (input.referenceStillCount ?? 0) > 0;
  const stillsReady = (input.artifactStillCount ?? 0) > 0 || types.includes("still") || types.includes("panel") || types.includes("variation");
  const motionReady = types.some((type) => MOTION_TYPES.has(type));
  const assemblyReady = types.some((type) => ASSEMBLY_TYPES.has(type));
  const complete = {
    script: scriptReady,
    panels: panelsReady,
    references: referencesReady,
    stills: stillsReady,
    motion: motionReady,
    assembly: assemblyReady,
  };
  const steps = STORYBOARD_PROGRESS_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    complete: complete[step.id],
  }));
  return {
    steps,
    completeCount: steps.filter((step) => step.complete).length,
    total: steps.length,
  };
}

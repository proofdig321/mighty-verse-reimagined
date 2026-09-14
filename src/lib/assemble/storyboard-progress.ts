/**
 * Storyboard progress is derived from live workspace state.
 * Not a wizard table and not a fake percentage.
 *
 * SCRIPT → PANELS → GALLERY STILLS → MOTION ARTIFACT
 * Canonical Scenes remain a separate authoring path.
 */

export const STORYBOARD_PROGRESS_STEPS = [
  { id: "script", label: "Story body" },
  { id: "panels", label: "Panels" },
  { id: "stills", label: "Gallery stills" },
  { id: "motion", label: "Motion" },
] as const;

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

const MOTION_TYPES = new Set(["animation", "clip", "reel", "gif"]);

export function deriveStoryboardProgress(input: {
  script?: string | null;
  panelCount?: number;
  referenceStillCount?: number;
  artifactStillCount?: number;
  artifactTypes?: string[];
}): StoryboardProgress {
  const scriptReady = Boolean(input.script?.trim());
  const panelsReady = (input.panelCount ?? 0) > 0;
  const stillsReady = (input.referenceStillCount ?? 0) > 0 || (input.artifactStillCount ?? 0) > 0;
  const motionReady = (input.artifactTypes ?? []).some((type) => MOTION_TYPES.has(type));
  const complete = {
    script: scriptReady,
    panels: panelsReady,
    stills: stillsReady,
    motion: motionReady,
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

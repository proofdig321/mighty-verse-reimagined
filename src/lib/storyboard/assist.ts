export const ASSIST_ACTIONS = [
  { id: "improve", label: "Improve story", instruction: "Improve the story for cinematic clarity without adding canonical Scenes." },
  { id: "expand", label: "Expand story", instruction: "Expand the story with richer visual beats. Do not invent canonical Scenes." },
  { id: "condense", label: "Condense story", instruction: "Condense the story. Keep the strongest visual beats." },
  { id: "create-storyboard", label: "Create storyboard", instruction: "Turn the story into a structured storyboard." },
  { id: "rewrite-panel", label: "Rewrite panel", instruction: "Rewrite only the selected panel. Preserve the rest of the story." },
  { id: "suggest-camera", label: "Suggest camera", instruction: "Suggest camera, movement, and framing for the selected panel." },
  { id: "suggest-action", label: "Suggest action", instruction: "Suggest clearer physical action for the selected panel." },
  { id: "suggest-transition", label: "Suggest transition", instruction: "Suggest a transition out of the selected panel." },
  { id: "suggest-references", label: "Suggest references", instruction: "Suggest character, environment, and style references a curator should attach. Do not invent gallery IDs." },
  { id: "visual-prompt", label: "Create visual prompt", instruction: "Write a still-generation prompt for the selected panel." },
  { id: "motion-prompt", label: "Create motion prompt", instruction: "Write a motion-generation prompt for the selected panel." },
  { id: "alternate", label: "Create alternate", instruction: "Propose an alternate visual treatment for the selected panel." },
  { id: "continue", label: "Continue story", instruction: "Continue the story after the current ending." },
  { id: "next-panel", label: "Generate next panel", instruction: "Propose the next storyboard panel after the selected one." },
  { id: "short-form", label: "Create short-form version", instruction: "Rewrite as a short-form vertical reel sequence." },
] as const;

export type AssistActionId = (typeof ASSIST_ACTIONS)[number]["id"];

export function assistAction(id: string) {
  return ASSIST_ACTIONS.find((item) => item.id === id) ?? null;
}

const STORY_REPLACE_ACTIONS = new Set([
  "assist",
  "improve",
  "expand",
  "condense",
  "create-storyboard",
  "continue",
  "short-form",
]);

export function assistReplacesStory(actionId: string): boolean {
  return STORY_REPLACE_ACTIONS.has(actionId);
}

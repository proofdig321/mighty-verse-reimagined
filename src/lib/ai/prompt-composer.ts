/**
 * Creative prompt construction for Gemini text and Veo motion.
 * Creative context only — no database dumps, UUIDs, or internal records.
 */

export type MotionIntent = {
  style?: string | null;
  animationStyle?: string | null;
  motionDirection?: string | null;
  cameraMovement?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: "16:9" | "9:16" | null;
  audioIntention?: string | null;
  orientation?: "landscape" | "portrait" | null;
};

export type PanelPromptInput = {
  storyTitle?: string | null;
  storyBody?: string | null;
  panel: {
    title: string;
    description: string;
    narrative_purpose?: string | null;
    action?: string | null;
    dialogue?: string | null;
    narration?: string | null;
    camera?: string | null;
    camera_movement?: string | null;
    framing?: string | null;
    lens_style?: string | null;
    lighting?: string | null;
    environment?: string | null;
    characters?: string | null;
    mood?: string | null;
    transition?: string | null;
  };
  previousTitle?: string | null;
  nextTitle?: string | null;
  selectedReferences?: string[];
  instruction?: string | null;
};

const STILL_PREFIX =
  "Cinematic storyboard still, African futurist music universe, no text overlay, no captions, no watermarks.";

export function composeStillPrompt(input: PanelPromptInput): string {
  return [
    STILL_PREFIX,
    input.panel.title,
    input.panel.description,
    field("Subject", input.panel.characters),
    field("Environment", input.panel.environment),
    field("Action", input.panel.action),
    field("Framing", input.panel.framing),
    field("Lighting", input.panel.lighting),
    field("Mood", input.panel.mood),
    field("Style", input.panel.lens_style),
    input.selectedReferences?.length ? `Visual references in play: ${input.selectedReferences.join("; ")}` : "",
    input.instruction,
  ]
    .filter(Boolean)
    .join("\n");
}

export function composeMotionPrompt(input: PanelPromptInput, motion: MotionIntent = {}): string {
  const aspect = motion.aspectRatio ?? (motion.orientation === "portrait" ? "9:16" : "16:9");
  const style = motion.animationStyle || motion.style || input.panel.lens_style || "cinematic live-action";
  return [
    `A ${style} motion picture.`,
    input.panel.characters ? `The subject is ${input.panel.characters}.` : input.panel.title,
    input.panel.action || input.panel.description,
    input.panel.environment ? `The environment is ${input.panel.environment}.` : "",
    cameraLine(input.panel.camera, motion.cameraMovement || input.panel.camera_movement, input.panel.framing),
    input.panel.lighting ? `Lighting: ${input.panel.lighting}.` : "",
    input.panel.mood ? `Atmosphere: ${input.panel.mood}.` : "",
    motion.motionDirection ? `Motion: ${motion.motionDirection}.` : "",
    audioLine(input.panel.dialogue, input.panel.narration, motion.audioIntention),
    input.panel.transition ? `The shot resolves toward: ${input.panel.transition}.` : "",
    `Aspect ${aspect}. Photoreal texture unless the style is explicitly animation.`,
    input.instruction,
  ]
    .filter(Boolean)
    .join(" ");
}

export function composeAssistPrompt(input: {
  action: string;
  storyTitle?: string | null;
  storyBody?: string | null;
  panel?: PanelPromptInput["panel"] | null;
  instruction?: string | null;
}): string {
  return [
    input.storyTitle ? `Story: ${input.storyTitle}` : "",
    input.storyBody ? `Current story body:\n${input.storyBody}` : "No current story body.",
    input.panel
      ? [
          `Selected panel: ${input.panel.title}`,
          input.panel.description,
          field("Action", input.panel.action),
          field("Camera", input.panel.camera),
          field("Dialogue", input.panel.dialogue),
        ]
          .filter(Boolean)
          .join("\n")
      : "No panel is selected. Work at storyboard scope.",
    `Curator action: ${input.action}`,
    input.instruction ? `Curator instruction:\n${input.instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function field(label: string, value?: string | null) {
  return value?.trim() ? `${label}: ${value.trim()}` : "";
}

function cameraLine(camera?: string | null, movement?: string | null, framing?: string | null) {
  const parts = [camera, movement, framing].filter(Boolean);
  return parts.length ? `Camera: ${parts.join(", ")}.` : "Camera: motivated cinematic coverage.";
}

function audioLine(dialogue?: string | null, narration?: string | null, intention?: string | null) {
  const bits = [
    dialogue ? `Spoken dialogue: "${dialogue}"` : "",
    narration ? `Narration: ${narration}` : "",
    intention ? `Sound: ${intention}` : "Natural ambience and diegetic sound.",
  ].filter(Boolean);
  return bits.join(". ");
}

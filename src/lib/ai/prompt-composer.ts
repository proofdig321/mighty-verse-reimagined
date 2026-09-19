/**
 * Creative prompt construction for Gemini text and Veo motion.
 * Creative context only — no database dumps, UUIDs, or internal records.
 *
 * Two entry points:
 *   composeStillPrompt / composeMotionPrompt — existing panel-scoped path (unchanged)
 *   composeStillPromptFromContext / composeMotionPromptFromContext — full CreativeContext path
 */
import type { CreativeContext, DocumentedParticipant } from "@/lib/storyboard/creative-context";

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

export type SentinelObservationPrompt = {
  what_happens?: string | null;
  framing?: string | null;
  camera?: string | null;
  camera_explanation?: string | null;
  action?: string | null;
  subjects?: string | null;
  environment?: string | null;
  motion?: string | null;
  lighting?: string | null;
  analysis_mode?: string | null;
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
  sentinelObservation?: SentinelObservationPrompt | null;
  sourceLabel?: string | null;
};

const STILL_PREFIX =
  "Cinematic storyboard still, African futurist music universe, no text overlay, no captions, no watermarks.";

export function composeObservationContext(observation?: SentinelObservationPrompt | null): string {
  if (!observation) return "";
  return [
    "Sentinel observation (evidence only — not a creative instruction):",
    observation.what_happens,
    field("Observed subjects", observation.subjects),
    field("Observed action", observation.action),
    field("Observed framing", observation.framing),
    field("Observed motion", observation.motion),
    field("Observed environment", observation.environment),
    field("Observed lighting", observation.lighting),
    `Camera: ${cameraEvidenceLine(observation.camera, observation.camera_explanation)}`,
    observation.analysis_mode === "sampled-fallback"
      ? "Evidence mode: sampled-frame fallback, not full-video understanding."
      : observation.analysis_mode === "gemini-sampled-frames"
        ? "Evidence mode: Gemini sampled frames, not full-video understanding."
        : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function composeStillPrompt(input: PanelPromptInput): string {
  return [
    STILL_PREFIX,
    input.sourceLabel ? `Source: ${input.sourceLabel}` : "",
    input.panel.title,
    input.panel.description,
    field("Subject", input.panel.characters),
    field("Environment", input.panel.environment),
    field("Action", input.panel.action),
    field("Framing", input.panel.framing),
    field("Lighting", input.panel.lighting),
    field("Mood", input.panel.mood),
    field("Style", input.panel.lens_style),
    composeObservationContext(input.sentinelObservation),
    input.selectedReferences?.length ? `Visual references in play: ${input.selectedReferences.join("; ")}` : "",
    input.instruction ? `Creator directive: ${input.instruction}` : "",
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
    composeObservationContext(input.sentinelObservation).replace(/\n/g, " "),
    input.selectedReferences?.length ? `Visual references in play: ${input.selectedReferences.join("; ")}.` : "",
    input.instruction ? `Creator directive: ${input.instruction}` : "",
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

// ---------------------------------------------------------------------------
// CreativeContext serialization — provider-neutral structured context → string
// ---------------------------------------------------------------------------

/**
 * Serialize documented participants into a concise prompt block.
 * Clearly labelled as documented credits — not generated interpretation.
 * panel.characters (free text) is kept separate and passed through panel fields.
 */
function serializeParticipants(participants: DocumentedParticipant[]): string {
  if (!participants.length) return "";
  const lines = participants.map((p) => {
    const desc = p.description ? ` — ${p.description}` : "";
    return `${p.name} (${p.role})${desc}`;
  });
  return `Documented creative credits:\n${lines.join("\n")}`;
}

/**
 * Build a PanelPromptInput from a full CreativeContext.
 * Adds universe and participant context on top of the existing panel fields.
 * Creator directive, Sentinel evidence, and references are preserved as-is.
 */
export function panelPromptInputFromContext(ctx: CreativeContext): PanelPromptInput & { _creativeContextHeader: string } {
  const headerParts: string[] = [];

  if (ctx.universe) {
    headerParts.push(`Universe: ${ctx.universe.title}`);
    if (ctx.universe.description) headerParts.push(ctx.universe.description);
  }

  if (ctx.documentedParticipants.length) {
    headerParts.push(serializeParticipants(ctx.documentedParticipants));
  }

  if (ctx.work.premise) headerParts.push(`Premise: ${ctx.work.premise}`);
  if (ctx.work.tone) headerParts.push(`Tone: ${ctx.work.tone}`);
  if (ctx.work.genre) headerParts.push(`Genre: ${ctx.work.genre}`);

  return {
    storyTitle: ctx.work.title,
    storyBody: null,
    panel: ctx.panel,
    selectedReferences: ctx.panel.references.map((r) => r.label).filter(Boolean),
    instruction: ctx.creatorDirective,
    sentinelObservation: ctx.sentinelEvidence
      ? {
          what_happens: ctx.sentinelEvidence.what_happens,
          framing: ctx.sentinelEvidence.framing,
          camera: ctx.sentinelEvidence.camera,
          camera_explanation: ctx.sentinelEvidence.camera_explanation,
          action: ctx.sentinelEvidence.action,
          subjects: ctx.sentinelEvidence.subjects,
          environment: ctx.sentinelEvidence.environment,
          motion: ctx.sentinelEvidence.motion,
          lighting: ctx.sentinelEvidence.lighting,
          analysis_mode: ctx.sentinelEvidence.analysis_mode,
        }
      : null,
    sourceLabel: null,
    _creativeContextHeader: headerParts.join("\n"),
  };
}

/**
 * Compose a still prompt from a full CreativeContext.
 * Universe identity and documented participants appear before panel fields.
 * Creator directive remains last and authoritative.
 */
export function composeStillPromptFromContext(ctx: CreativeContext): string {
  const base = panelPromptInputFromContext(ctx);
  return [
    STILL_PREFIX,
    base._creativeContextHeader,
    base.panel.title,
    base.panel.description,
    field("Subject", base.panel.characters),
    field("Environment", base.panel.environment),
    field("Action", base.panel.action),
    field("Framing", base.panel.framing),
    field("Lighting", base.panel.lighting),
    field("Mood", base.panel.mood),
    field("Style", base.panel.lens_style),
    composeObservationContext(base.sentinelObservation),
    base.selectedReferences?.length ? `Visual references in play: ${base.selectedReferences.join("; ")}` : "",
    base.instruction ? `Creator directive: ${base.instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Compose a motion prompt from a full CreativeContext.
 * Universe identity and documented participants appear before panel fields.
 * Creator directive remains last and authoritative.
 */
export function composeMotionPromptFromContext(ctx: CreativeContext, motion: MotionIntent = {}): string {
  const base = panelPromptInputFromContext(ctx);
  const aspect = motion.aspectRatio ?? (motion.orientation === "portrait" ? "9:16" : "16:9");
  const style = motion.animationStyle || motion.style || base.panel.lens_style || "cinematic live-action";
  return [
    `A ${style} motion picture.`,
    base._creativeContextHeader,
    base.panel.characters ? `The subject is ${base.panel.characters}.` : base.panel.title,
    base.panel.action || base.panel.description,
    base.panel.environment ? `The environment is ${base.panel.environment}.` : "",
    cameraLine(base.panel.camera, motion.cameraMovement || base.panel.camera_movement, base.panel.framing),
    base.panel.lighting ? `Lighting: ${base.panel.lighting}.` : "",
    base.panel.mood ? `Atmosphere: ${base.panel.mood}.` : "",
    motion.motionDirection ? `Motion: ${motion.motionDirection}.` : "",
    audioLine(base.panel.dialogue, base.panel.narration, motion.audioIntention),
    base.panel.transition ? `The shot resolves toward: ${base.panel.transition}.` : "",
    `Aspect ${aspect}. Photoreal texture unless the style is explicitly animation.`,
    composeObservationContext(base.sentinelObservation).replace(/\n/g, " "),
    base.selectedReferences?.length ? `Visual references in play: ${base.selectedReferences.join("; ")}.` : "",
    base.instruction ? `Creator directive: ${base.instruction}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function field(label: string, value?: string | null) {
  return value?.trim() ? `${label}: ${value.trim()}` : "";
}

function unknownCamera(value?: string | null) {
  if (!value?.trim()) return true;
  const text = value.trim().toLowerCase();
  return text === "unknown" || text.includes("could not be determined") || text.includes("insufficient evidence");
}

function cameraEvidenceLine(camera?: string | null, explanation?: string | null) {
  if (unknownCamera(camera) && unknownCamera(explanation)) {
    return "unknown / insufficient evidence. Do not invent camera movement.";
  }
  return [explanation, camera].filter((value) => value && !unknownCamera(value)).join(" — ") || "unknown / insufficient evidence. Do not invent camera movement.";
}

function cameraLine(camera?: string | null, movement?: string | null, framing?: string | null) {
  const parts = [camera, movement, framing].filter((value) => value && !unknownCamera(value));
  return parts.length ? `Camera: ${parts.join(", ")}.` : "Camera: unknown / insufficient evidence. Do not invent camera movement.";
}

function audioLine(dialogue?: string | null, narration?: string | null, intention?: string | null) {
  const bits = [
    dialogue ? `Spoken dialogue: "${dialogue}"` : "",
    narration ? `Narration: ${narration}` : "",
    intention ? `Sound: ${intention}` : "Natural ambience and diegetic sound.",
  ].filter(Boolean);
  return bits.join(". ");
}

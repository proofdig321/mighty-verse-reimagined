"use client";

/**
 * Creative operation selector.
 * Creator sees: Image · Video · Animate · GIF · Reel
 * System resolves the correct GenerationJobKind from intent + available inputs.
 * Backend kinds are never exposed as primary vocabulary.
 */

import { cn } from "@/lib/utils";
import type { GenerationJobKind } from "@/lib/ai/jobs";

export type CreativeIntent = "still" | "clip" | "animation" | "gif" | "reel";

export type CreativePreset = {
  id: string;
  label: string;
  intent: CreativeIntent;
  defaults: {
    aspectRatio?: "16:9" | "9:16";
    durationSeconds?: 4 | 6 | 8;
    promptPrefix?: string;
    generateAudio?: boolean;
  };
};

export const PRESETS: CreativePreset[] = [
  { id: "cinematic",   label: "Cinematic",   intent: "clip",      defaults: { aspectRatio: "16:9", durationSeconds: 8, generateAudio: false } },
  { id: "performance", label: "Performance", intent: "clip",      defaults: { aspectRatio: "16:9", durationSeconds: 6, generateAudio: true } },
  { id: "music-video", label: "Music Video", intent: "animation", defaults: { aspectRatio: "16:9", durationSeconds: 8, generateAudio: true } },
  { id: "social",      label: "Social/Reel", intent: "reel",      defaults: { aspectRatio: "9:16", durationSeconds: 6, generateAudio: false } },
  { id: "visualizer",  label: "Visualizer",  intent: "animation", defaults: { aspectRatio: "16:9", durationSeconds: 8, generateAudio: false } },
  { id: "transform",   label: "Transform",   intent: "clip",      defaults: { aspectRatio: "16:9", durationSeconds: 8, generateAudio: false } },
  { id: "extend",      label: "Extend",      intent: "clip",      defaults: { aspectRatio: "16:9", durationSeconds: 8, generateAudio: false } },
];

/** Veo only accepts these durations. */
export const VEO_DURATIONS = [4, 6, 8] as const;
export type VeoDuration = (typeof VEO_DURATIONS)[number];

export function clampVeoDuration(v: number): VeoDuration {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  return 8;
}

const INTENTS: { id: CreativeIntent; label: string; description: string }[] = [
  { id: "still",     label: "Image",   description: "Generate a still image" },
  { id: "clip",      label: "Video",   description: "Generate a video clip" },
  { id: "animation", label: "Animate", description: "Cinematic animation" },
  { id: "gif",       label: "GIF",     description: "Looping GIF" },
  { id: "reel",      label: "Reel",    description: "Short-form reel" },
];

export type Capability = {
  configured: boolean;
  text?: boolean;
  image?: boolean;
  video?: boolean;
  modes?: Record<string, { available: boolean; reason: string | null }>;
} | null;

export function intentAvailable(intent: CreativeIntent, capability: Capability): boolean {
  if (!capability?.configured) return false;
  if (intent === "still") return Boolean(capability.image || capability.text);
  return Boolean(capability.video);
}

export function modeAvailable(mode: string, capability: Capability): boolean {
  if (!capability?.configured) return false;
  if (!capability.modes) return Boolean(capability.video);
  return capability.modes[mode]?.available ?? false;
}

/**
 * Resolve the backend GenerationJobKind from creator intent + available inputs.
 * The creator never sees these kind names.
 */
export function resolveKind(input: {
  intent: CreativeIntent;
  firstFrame: string;
  lastFrame: string;
  referenceUrls: string[];
  extensionVideoUri: string | null;
  sourceVideoUri?: string | null;
  editVideoUri?: string | null;
}): GenerationJobKind {
  if (input.intent === "still") return "still";
  if (input.intent === "gif") return "gif";
  if (input.intent === "reel") return "reel";
  // Edit: source video + directive (distinct from extend)
  if (input.editVideoUri && !input.extensionVideoUri) return "edit";
  // Extension: source video present, no first frame, no refs
  if (input.extensionVideoUri && !input.firstFrame && !input.referenceUrls.length) return "extend";
  // First + last frame
  if (input.firstFrame && input.lastFrame) return "first-last-frame";
  // Reference images
  if (input.referenceUrls.length > 0) return "reference-motion";
  // Image to video
  if (input.firstFrame) return "animate-still";
  return input.intent === "animation" ? "animation" : "motion";
}

/**
 * Describe the active workflow in creator-facing language.
 */
export function describeWorkflow(input: {
  intent: CreativeIntent;
  hasFirstFrame: boolean;
  hasLastFrame: boolean;
  hasReferences: boolean;
  hasExtensionVideo: boolean;
  hasEditVideo?: boolean;
}): string {
  if (input.intent === "still") return "Text to image";
  if (input.intent === "gif") return "Create GIF";
  if (input.intent === "reel") return "Assemble reel";
  if (input.hasEditVideo && !input.hasExtensionVideo) return "Edit video";
  if (input.hasExtensionVideo && !input.hasFirstFrame && !input.hasReferences) return "Extend video";
  if (input.hasFirstFrame && input.hasLastFrame) return "First + last frame";
  if (input.hasReferences) return "Reference to video";
  if (input.hasFirstFrame) return "Animate image";
  return "Text to video";
}

export function CreativeIntentPicker({
  selected,
  onSelect,
  capability,
}: {
  selected: CreativeIntent;
  onSelect: (intent: CreativeIntent) => void;
  capability: Capability;
}) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-border/50 bg-muted/40 p-0.5"
      role="group"
      aria-label="Output type"
    >
      {INTENTS.map((intent) => {
        const available = intentAvailable(intent.id, capability);
        const isSelected = selected === intent.id;
        return (
          <button
            key={intent.id}
            type="button"
            disabled={!available}
            title={available ? intent.description : `${intent.description} — provider not configured`}
            onClick={() => onSelect(intent.id)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : available
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/25 cursor-not-allowed",
            )}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}

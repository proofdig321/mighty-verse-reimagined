import type { GenerationJobKind } from "@/lib/ai/jobs";

export type GenerationReadinessIntent = "still" | "clip" | "animation" | "gif" | "reel";

export type GenerationReadiness = {
  available: boolean;
  reason: string | null;
};

export function deriveGenerationReadiness(input: {
  intent: GenerationReadinessIntent;
  resolvedKind: GenerationJobKind;
  hasStill: boolean;
  hasMotion: boolean;
  stillReady: GenerationReadiness;
  motionReady: GenerationReadiness;
  effectiveFirstFrame: string;
  effectiveLastFrame: string;
  referenceUrls: string[];
  extensionVideoUri: string | null;
  effectiveEditUri: string | null;
  workFramesLength: number;
}): GenerationReadiness {
  if (input.intent === "still") return input.stillReady;
  if (input.resolvedKind === "animate-still") return { available: input.hasStill, reason: input.hasStill ? null : "Generate or select a still first" };
  if (input.resolvedKind === "first-last-frame") {
    const ok = Boolean(input.effectiveFirstFrame && input.effectiveLastFrame);
    return { available: ok, reason: ok ? null : "Select a first and last frame" };
  }
  if (input.resolvedKind === "reference-motion") {
    const ok = input.referenceUrls.length > 0;
    return { available: ok, reason: ok ? null : "Add at least one reference" };
  }
  if (input.resolvedKind === "extend") {
    const ok = Boolean(input.extensionVideoUri);
    return { available: ok, reason: ok ? null : "Generate a clip first" };
  }
  if (input.resolvedKind === "edit") {
    const ok = Boolean(input.effectiveEditUri);
    return { available: ok, reason: ok ? null : "Paste a video URI to edit" };
  }
  if (input.intent === "gif") return { available: input.hasStill || input.hasMotion, reason: (input.hasStill || input.hasMotion) ? null : "Generate a still or clip first" };
  if (input.intent === "reel") return { available: input.workFramesLength > 0 || input.hasStill, reason: (input.workFramesLength > 0 || input.hasStill) ? null : "Add source frames first" };
  return input.motionReady;
}

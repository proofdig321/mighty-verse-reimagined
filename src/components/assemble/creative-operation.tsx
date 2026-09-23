"use client";

/**
 * Creative operation selector.
 * Maps creator intent to GenerationJobKind based on available inputs.
 * Creator sees: Still · Clip · Animation · GIF · Reel
 * System resolves the correct GenerationJobKind internally.
 */

import { cn } from "@/lib/utils";
import type { GenerationJobKind } from "@/lib/ai/jobs";

export type CreativeIntent = "still" | "clip" | "animation" | "gif" | "reel";

const INTENTS: { id: CreativeIntent; label: string; description: string }[] = [
  { id: "still",     label: "Still",     description: "Single image frame" },
  { id: "clip",      label: "Clip",      description: "Video clip" },
  { id: "animation", label: "Animation", description: "Cinematic animation" },
  { id: "gif",       label: "GIF",       description: "Looping GIF" },
  { id: "reel",      label: "Reel",      description: "Short-form reel" },
];

type Capability = {
  configured: boolean;
  text?: boolean;
  image?: boolean;
  video?: boolean;
} | null;

export function intentAvailable(intent: CreativeIntent, capability: Capability): boolean {
  if (!capability?.configured) return false;
  if (intent === "still") return Boolean(capability.image || capability.text);
  return Boolean(capability.video);
}

export function resolveKind(input: {
  intent: CreativeIntent;
  firstFrame: string;
  lastFrame: string;
  referenceUrls: string[];
  extensionVideoUri: string | null;
}): GenerationJobKind {
  if (input.intent === "still") return "still";
  if (input.intent === "gif") return "gif";
  if (input.intent === "reel") return "reel";
  if (input.firstFrame && input.lastFrame) return "first-last-frame";
  if (input.referenceUrls.length > 0) return "reference-motion";
  if (input.firstFrame) return "animate-still";
  if (input.extensionVideoUri) return "extend";
  return input.intent === "animation" ? "animation" : "motion";
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

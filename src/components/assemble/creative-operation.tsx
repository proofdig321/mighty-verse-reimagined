"use client";

/**
 * Creative operation selector.
 *
 * Maps creator intent (what do you want to make?) to the correct
 * GenerationJobKind based on available inputs and provider capability.
 *
 * The creator sees: Still · Clip · Animation · GIF · Reel
 * The system resolves: still / motion / animate-still / first-last-frame /
 *   reference-motion / extend / animation / gif / reel
 *
 * This is the only place that maps intent → kind.
 * The rest of the system uses GenerationJobKind directly.
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

/**
 * Resolve the correct GenerationJobKind for a given intent + available inputs.
 *
 * still:
 *   → "still" always
 *
 * clip:
 *   has firstFrame + lastFrame → "first-last-frame"
 *   has firstFrame (still)     → "animate-still"
 *   has referenceUrls          → "reference-motion"  (character/style stills)
 *   has extensionVideoUri      → "extend"
 *   otherwise                  → "motion" (text-to-video)
 *
 * animation:
 *   → "animation" always (Veo cinematic animation style)
 *
 * gif:
 *   → "gif" (ffmpeg derives from existing motion or still)
 *
 * reel:
 *   → "reel" (ffmpeg assembles from panel stills/motion)
 */
export function resolveKind(input: {
  intent: CreativeIntent;
  firstFrame: string;
  lastFrame: string;
  referenceUrls: string[];
  extensionVideoUri: string | null;
}): GenerationJobKind {
  if (input.intent === "still") return "still";
  if (input.intent === "animation") return "animation";
  if (input.intent === "gif") return "gif";
  if (input.intent === "reel") return "reel";
  // clip — resolve based on available inputs
  if (input.firstFrame && input.lastFrame) return "first-last-frame";
  if (input.firstFrame) return "animate-still";
  if (input.referenceUrls.length > 0) return "reference-motion";
  if (input.extensionVideoUri) return "extend";
  return "motion";
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
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="What do you want to make?">
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
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              isSelected
                ? "border-primary bg-primary/20 text-foreground"
                : available
                ? "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
                : "border-border/30 bg-transparent text-muted-foreground/30 cursor-not-allowed",
            )}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}

// Media readiness — derived from existing data, no new state machine.
// Returns a structured readiness object for display in the Media Library and asset workspace.

export type MediaReadiness = {
  overall: "intake" | "processing" | "playable" | "ready";
  steps: MediaReadinessStep[];
  blockers: string[];
};

export type MediaReadinessStep = {
  label: string;
  state: "complete" | "pending" | "not-applicable";
};

type ReadinessInput = {
  hasAsset: boolean;
  isPlaceholder: boolean;
  hasRights: boolean;
  hasCredits: boolean;
  isrcStatus: string | null; // 'verified' | 'not-provided' | 'not-applicable' | 'pending' | 'assignment-required' | null
  workType: string | null;   // 'song' | 'audio' | 'video' | 'animation' | 'other' | null
};

export function deriveMediaReadiness(input: ReadinessInput): MediaReadiness {
  const { hasAsset, isPlaceholder, hasRights, hasCredits, isrcStatus, workType } = input;

  const playable = hasAsset && !isPlaceholder;
  const isrcApplicable = workType === "song" || workType === "audio";
  const isrcComplete = !isrcApplicable || isrcStatus === "verified" || isrcStatus === "not-provided";

  const steps: MediaReadinessStep[] = [
    { label: "Ingested", state: playable ? "complete" : hasAsset ? "pending" : "pending" },
    { label: "Rights", state: hasRights ? "complete" : "pending" },
    { label: "Credits", state: hasCredits ? "complete" : "pending" },
    {
      label: "Identifier",
      state: !isrcApplicable ? "not-applicable" : isrcComplete ? "complete" : "pending",
    },
  ];

  const blockers: string[] = [];
  if (!playable) blockers.push("Media not yet ingested");
  if (!hasRights) blockers.push("Rights not recorded");
  if (!hasCredits) blockers.push("No credits recorded");
  if (isrcApplicable && !isrcComplete) blockers.push("ISRC required");

  let overall: MediaReadiness["overall"] = "intake";
  if (playable && hasRights && hasCredits && isrcComplete) {
    overall = "ready";
  } else if (playable) {
    overall = "playable";
  } else if (hasAsset) {
    overall = "processing";
  }

  return { overall, steps, blockers };
}

export const READINESS_LABELS: Record<MediaReadiness["overall"], string> = {
  intake: "Intake",
  processing: "Processing",
  playable: "Playable",
  ready: "Ready",
};

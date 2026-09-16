/**
 * Visible panel lifecycle in the Storyboard workspace.
 * Distinct from persisted storyboard_panel.status (draft/ready/generating).
 */

export type PanelUiStatus =
  | "draft"
  | "ready"
  | "generating"
  | "generated"
  | "failed"
  | "selected";

export type PanelJobLike = {
  panel_id: string | null;
  status: string;
  kind?: string;
};

export function derivePanelUiStatus(input: {
  selected: boolean;
  persistedStatus?: string | null;
  stillUrl?: string | null;
  motionPlaybackId?: string | null;
  jobs?: PanelJobLike[];
}): PanelUiStatus {
  const jobs = input.jobs ?? [];
  const running = jobs.some((job) => job.status === "queued" || job.status === "submitted" || job.status === "processing");
  if (running) return "generating";
  const failed = jobs.some((job) => job.status === "failed" || job.status === "unavailable" || job.status === "blocked");
  const hasArtifact = Boolean(input.stillUrl || input.motionPlaybackId);
  if (failed && !hasArtifact) return "failed";
  if (input.selected && hasArtifact) return "selected";
  if (hasArtifact) return "generated";
  if (input.persistedStatus === "ready") return "ready";
  return "draft";
}

export function panelUiLabel(status: PanelUiStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready";
    case "generating":
      return "Generating";
    case "generated":
      return "Generated";
    case "failed":
      return "Failed";
    case "selected":
      return "Selected";
  }
}

export function motionRequirement(input: {
  kind: string;
  stillUrl?: string | null;
  lastFrameUrl?: string | null;
  referenceUrls?: string[];
  extensionVideoUri?: string | null;
}): { available: boolean; reason: string | null } {
  if (input.kind === "animate-still" || input.kind === "motion" && input.stillUrl) {
    if (!input.stillUrl) {
      return { available: false, reason: "Select a still before starting image-to-video generation." };
    }
    return { available: true, reason: null };
  }
  if (input.kind === "first-last-frame") {
    if (!input.stillUrl || !input.lastFrameUrl) {
      return { available: false, reason: "First/last-frame animation needs a first frame and a last frame." };
    }
    return { available: true, reason: null };
  }
  if (input.kind === "reference-motion") {
    if (!(input.referenceUrls ?? []).length) {
      return { available: false, reason: "Reference-image animation requires at least one compatible reference image." };
    }
    return { available: true, reason: null };
  }
  if (input.kind === "extend") {
    if (!input.extensionVideoUri) {
      return { available: false, reason: "Video extension requires a compatible generated video source." };
    }
    return { available: true, reason: null };
  }
  return { available: true, reason: null };
}

export function stillGenerationReady(input: {
  panelSelected: boolean;
  hasObservation?: boolean;
  hasReference?: boolean;
  hasDirective?: boolean;
}): { available: boolean; reason: string | null } {
  if (!input.panelSelected) {
    return { available: false, reason: "Select a panel from Sentinel or Panels before generating a still." };
  }
  if (!input.hasObservation && !input.hasReference) {
    return { available: false, reason: "Choose a Sentinel observation or reference before generating a still." };
  }
  if (!input.hasDirective) {
    return { available: false, reason: "Write a creator directive before generating a still." };
  }
  return { available: true, reason: null };
}

export function primaryMotionKind(input: { stillUrl?: string | null }): "animate-still" | "motion" {
  return input.stillUrl ? "animate-still" : "motion";
}

export function motionGenerationReady(input: {
  stillUrl?: string | null;
  hasDirective?: boolean;
  hasReference?: boolean;
}): { available: boolean; reason: string | null } {
  if (input.stillUrl) return { available: true, reason: null };
  if (input.hasDirective || input.hasReference) return { available: true, reason: null };
  return { available: false, reason: "Generate or select a still, or write a creator directive, before generating motion." };
}

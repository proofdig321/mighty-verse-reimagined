import { sceneShortTitle } from "../assemble/composition";
import { formatTimelineMs } from "../media/timing";
import type { SuiteScene } from "../assemble/suite";
import type { StoryboardPanelRecord } from "./document";
import type { StoryboardScriptPanel } from "./script";
import type { SentinelIntelligence } from "../media/sentinel-intelligence";

export type StoryboardSelectionPresentation = {
  title: string;
  description: string;
  time: string | null;
  kind: string;
  still: string | null;
  camera: string | null;
  movement: string | null;
  transition: string | null;
  endpoint: string | null;
};

export function resolveStoryboardSelection(input: {
  selectedPersisted: StoryboardPanelRecord | null;
  selectedScript: StoryboardScriptPanel | null;
  selectedSentinel: SentinelIntelligence["storyboard"][number] | null;
  selectedScene: SuiteScene | null;
  panelStills: Record<string, string>;
}): StoryboardSelectionPresentation | null {
  const { selectedPersisted, selectedScript, selectedSentinel, selectedScene, panelStills } = input;

  if (selectedPersisted) {
    return {
      title: selectedPersisted.title,
      description: selectedPersisted.description,
      time: selectedPersisted.duration_ms ? `${Math.round(selectedPersisted.duration_ms / 1000)}s` : null,
      kind: "Storyboard panel",
      still: panelStills[selectedPersisted.panel_id] ?? selectedPersisted.still_url,
      camera: selectedPersisted.camera,
      movement: selectedPersisted.camera_movement,
      transition: selectedPersisted.transition,
      endpoint: selectedPersisted.motion_endpoint,
    };
  }

  if (selectedScript) {
    return {
      title: selectedScript.title,
      description: selectedScript.description,
      time: null,
      kind: "Script beat",
      still: panelStills[selectedScript.panel_id] ?? null,
      camera: selectedScript.camera,
      movement: selectedScript.movement,
      transition: selectedScript.transition,
      endpoint: null,
    };
  }

  if (selectedSentinel) {
    return {
      title: selectedSentinel.title,
      description:
        selectedSentinel.kind === "scene"
          ? "Canonical Scene. Sentinel observed this window; it did not create the Scene."
          : "Sentinel evidence. A storyboard beat is not a Scene.",
      time: formatTimelineMs(selectedSentinel.time_ms),
      kind: selectedSentinel.kind === "scene" ? "Canonical Scene" : "Sentinel beat",
      still: panelStills[selectedSentinel.panel_id] ?? selectedSentinel.still_url,
      camera: null,
      movement: null,
      transition: null,
      endpoint: null,
    };
  }

  if (selectedScene) {
    return {
      title: sceneShortTitle(selectedScene.title) ?? selectedScene.title ?? "Untitled scene",
      description: selectedScene.description ?? "Canonical Scene window.",
      time:
        selectedScene.start_ms != null && selectedScene.end_ms != null
          ? `${formatTimelineMs(selectedScene.start_ms)} → ${formatTimelineMs(selectedScene.end_ms)}`
          : null,
      kind: "Canonical Scene",
      still: panelStills[selectedScene.master_id] ?? null,
      camera: null,
      movement: null,
      transition: null,
      endpoint: null,
    };
  }

  return null;
}

export function collectActiveReferenceUrls(input: {
  references: { still_url: string | null }[];
  workFrames: { still_url: string }[];
  persistedPanels: { references: { url?: string | null }[] }[];
}): string[] {
  return [
    ...input.references.map((item) => item.still_url).filter(Boolean),
    ...(input.workFrames ?? []).map((frame) => frame.still_url),
    ...input.persistedPanels.flatMap((panel) => panel.references.map((ref) => ref.url).filter(Boolean)),
  ] as string[];
}

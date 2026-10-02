import type { StoryboardPanelRecord } from "./document";
import type { StoryboardScriptPanel } from "./script";

export type StoryboardWorkspaceStateInput = {
  persistedPanels?: Array<{ panel_id?: string; references?: Array<{ url?: string | null }> }>; 
  scriptPanels?: Array<{ panel_id?: string }>;
  sentinelPanels?: Array<{ panel_id?: string }>;
  scenes?: Array<{ master_id?: string }>;
};

export function deriveStoryboardSequenceState(input: StoryboardWorkspaceStateInput) {
  const persistedPanels = input.persistedPanels ?? [];
  const scriptPanels = input.scriptPanels ?? [];
  const sentinelPanels = input.sentinelPanels ?? [];
  const scenes = input.scenes ?? [];
  const creativeCount = persistedPanels.length + scriptPanels.length;

  return {
    creativeCount,
    sequenceEmpty: creativeCount === 0 && sentinelPanels.length === 0 && scenes.length === 0,
  };
}

export function buildStoryboardShotIds(input: StoryboardWorkspaceStateInput & { fallbackSceneIds?: string[] }) {
  const persistedPanels = input.persistedPanels ?? [];
  const scriptPanels = input.scriptPanels ?? [];
  const sentinelPanels = input.sentinelPanels ?? [];
  const scenes = input.scenes ?? [];

  const shotIds = [
    ...persistedPanels.map((panel) => panel.panel_id).filter(Boolean),
    ...scriptPanels.map((panel) => panel.panel_id).filter(Boolean),
    ...sentinelPanels.map((panel) => panel.panel_id).filter(Boolean),
    ...(persistedPanels.length === 0 && scriptPanels.length === 0 && sentinelPanels.length === 0
      ? (input.fallbackSceneIds ?? scenes.map((scene) => scene.master_id).filter(Boolean))
      : []),
  ] as string[];

  return [...new Set(shotIds)];
}

export function resolveStoryboardEditorPanel(input: {
  draftPanel: Partial<StoryboardPanelRecord>;
  selectedPersisted: StoryboardPanelRecord | null;
}) {
  return input.draftPanel.panel_id === input.selectedPersisted?.panel_id
    ? input.draftPanel
    : input.selectedPersisted ?? input.draftPanel;
}

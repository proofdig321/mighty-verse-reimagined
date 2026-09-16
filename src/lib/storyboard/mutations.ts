/**
 * In-memory Storyboard panel mutations.
 * Used by tests and by the server when applying snapshots.
 * These never create canonical Scenes.
 */

export type MutablePanel = {
  panel_id: string;
  sequence: number;
  title: string;
  description: string;
  [key: string]: unknown;
};

export function nextSequence(panels: Array<{ sequence: number }>): number {
  return panels.reduce((max, panel) => Math.max(max, panel.sequence), 0) + 1;
}

export function duplicatePanel<T extends MutablePanel>(panel: T, panelId: string, sequence: number): T {
  return {
    ...panel,
    panel_id: panelId,
    sequence,
    title: `${panel.title} copy`,
    user_locked: false,
    creates_scene: false,
  };
}

export function movePanelIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length) return ids;
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function applyOrder<T extends MutablePanel>(panels: T[], orderedIds: string[]): T[] {
  const byId = new Map(panels.map((panel) => [panel.panel_id, panel]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as T[];
  const leftover = panels.filter((panel) => !orderedIds.includes(panel.panel_id));
  return [...ordered, ...leftover].map((panel, index) => ({ ...panel, sequence: index + 1 }));
}

export function removePanel<T extends MutablePanel>(panels: T[], panelId: string): T[] {
  return applyOrder(
    panels.filter((panel) => panel.panel_id !== panelId),
    panels.filter((panel) => panel.panel_id !== panelId).map((panel) => panel.panel_id),
  );
}

export function sequenceOffsetRows(workId: string, panels: Array<{ panel_id: string; sequence: number }>) {
  return panels.map((panel) => ({
    panel_id: panel.panel_id,
    work_id: workId,
    sequence: panel.sequence + 10_000,
  }));
}

export const RESET_SCOPES = [
  "unsaved",
  "panel",
  "panel-artifacts",
  "saved",
  "initial",
] as const;

export type ResetScope = (typeof RESET_SCOPES)[number];

export function resetScopeCopy(scope: ResetScope): { title: string; body: string; destructive: boolean } {
  switch (scope) {
    case "unsaved":
      return {
        title: "Reset unsaved changes",
        body: "Discard edits that have not been saved. Saved story, panels, and generated artifacts stay.",
        destructive: false,
      };
    case "panel":
      return {
        title: "Reset current panel",
        body: "Restore this panel to its last saved authored fields. Generated stills and motion stay in history.",
        destructive: false,
      };
    case "panel-artifacts":
      return {
        title: "Reset generated artifacts for current panel",
        body: "Clear the selected still and motion on this panel. Generated files are kept in history and are not deleted from Mux.",
        destructive: true,
      };
    case "saved":
      return {
        title: "Reset storyboard to saved state",
        body: "Reload the last saved Storyboard Work. Unsaved edits are discarded. Generated artifacts already saved remain.",
        destructive: false,
      };
    case "initial":
      return {
        title: "Reset entire Storyboard to initial state",
        body: "Clear the story body and delete unlocked panels. Generated artifacts remain in history but are no longer selected. This does not create or delete canonical Scenes.",
        destructive: true,
      };
  }
}

export function associateReference<T extends { references: Array<{ role: string; label: string; asset_id?: string | null; url?: string | null }> }>(
  panel: T,
  reference: { role: string; label: string; asset_id?: string | null; url?: string | null },
): T {
  const exists = panel.references.some(
    (item) => (reference.asset_id && item.asset_id === reference.asset_id) || (reference.url && item.url === reference.url && item.label === reference.label),
  );
  if (exists) return panel;
  return { ...panel, references: [...panel.references, reference] };
}

export function disassociateReference<T extends { references: Array<{ asset_id?: string | null; url?: string | null; label: string }> }>(
  panel: T,
  match: { asset_id?: string | null; url?: string | null; label?: string },
): T {
  return {
    ...panel,
    references: panel.references.filter((item) => {
      if (match.asset_id) return item.asset_id !== match.asset_id;
      if (match.url && match.label) return !(item.url === match.url && item.label === match.label);
      if (match.url) return item.url !== match.url;
      return true;
    }),
  };
}

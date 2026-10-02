export function resolveStoryboardAttachmentTarget(input: {
  work: { panels: { panel_id: string }[] } | null;
  selectedId: string | null;
}) {
  const persistedId = input.work?.panels.some((panel) => panel.panel_id === input.selectedId)
    ? input.selectedId
    : null;

  return {
    persistedId,
    targetPanelId: persistedId,
  };
}

export function buildStoryboardReferenceAttachmentBody(input: {
  universeId: string | null;
  workId: string;
  panelId: string | null;
  assetId: string;
  stillUrl: string;
  title: string;
  timeMs: number;
}) {
  return {
    universe_id: input.universeId,
    action: "use-still",
    work_id: input.workId,
    panel_id: input.panelId,
    asset_id: input.assetId,
    still_url: input.stillUrl,
    title: input.title,
    time_ms: input.timeMs,
  };
}

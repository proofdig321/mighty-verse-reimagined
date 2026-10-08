"use client";

import { useCallback } from "react";
import { StoryboardTimelineEditor } from "./storyboard-timeline-editor";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";

export function StoryboardTimelineEditorShell({
  workId,
  panels,
}: {
  workId: string;
  panels: StoryboardPanelRecord[];
}) {
  const handleSaveDurations = useCallback(async (durations: Record<string, number>) => {
    await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-panel-durations",
        work_id: workId,
        durations,
      }),
    });
  }, [workId]);

  return (
    <StoryboardTimelineEditor
      panels={panels}
      onSaveDurations={handleSaveDurations}
    />
  );
}

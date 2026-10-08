"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbnailPicker } from "./thumbnail-picker";

type Props = {
  workId: string;
  panelId: string;
  currentUrl?: string | null;
  muxPlaybackId?: string | null;
  durationMs?: number | null;
  onSaved: (url: string) => void;
  onCancel: () => void;
};

export function PanelThumbnailPicker({
  workId,
  panelId,
  currentUrl,
  muxPlaybackId,
  durationMs,
  onSaved,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(url: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/authority/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "use-still",
          work_id: workId,
          panel_id: panelId,
          still_url: url,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not save thumbnail.");
      onSaved(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save thumbnail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-thumbnail-picker">
      <p className="suite-relation-kicker">Panel thumbnail</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <ThumbnailPicker
        currentUrl={currentUrl}
        muxPlaybackId={muxPlaybackId}
        durationMs={durationMs}
        busy={busy}
        label="panel thumbnail"
        onPick={(url) => void handlePick(url)}
        onCancel={onCancel}
      />
    </div>
  );
}

/** Compact trigger button shown on a panel card */
export function PanelThumbnailTrigger({
  currentUrl,
  onClick,
}: {
  currentUrl?: string | null;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {currentUrl ? "Change thumbnail" : "Set thumbnail"}
    </Button>
  );
}

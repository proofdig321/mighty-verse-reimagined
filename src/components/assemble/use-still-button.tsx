"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UseStillButton({
  universeId,
  stillUrl,
  assetId,
  title,
  timeMs,
  sentinelPanelId,
  sceneMasterId,
  label = "Use on storyboard",
}: {
  universeId: string;
  stillUrl: string | null;
  assetId?: string | null;
  title?: string;
  timeMs?: number | null;
  sentinelPanelId?: string | null;
  sceneMasterId?: string | null;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function attach() {
    if (!stillUrl) {
      setMessage("This still has no image yet.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "use-still",
        still_url: stillUrl,
        asset_id: assetId ?? null,
        title,
        time_ms: timeMs ?? null,
        sentinel_panel_id: sentinelPanelId ?? null,
        scene_master_id: sceneMasterId ?? null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      response.ok
        ? "Attached to a storyboard panel. Sentinel evidence is not a Scene."
        : typeof payload.error === "string"
          ? payload.error
          : "Still could not be attached.",
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="outline" disabled={busy || !stillUrl} onClick={() => void attach()}>
        {busy ? "Attaching…" : label}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

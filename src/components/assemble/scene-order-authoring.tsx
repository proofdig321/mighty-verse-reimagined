"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decideSceneOrder, proposeMovedSceneOrder } from "@/lib/assemble/scene-order";

async function saveSceneOrder(orders: { master_id: string; sort_order: number }[]) {
  const response = await fetch("/api/authority/masters/sort-order", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Scene order could not be saved.");
  }
}

export function SceneOrder({
  universeId,
  muralId,
  sceneId,
  sceneLabel,
  orderedSceneIds,
  canAuthor,
}: {
  universeId: string;
  muralId: string;
  sceneId: string;
  sceneLabel: string;
  orderedSceneIds: string[];
  canAuthor: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canAuthor) return null;

  const index = orderedSceneIds.indexOf(sceneId);
  const canEarlier = index > 0;
  const canLater = index >= 0 && index < orderedSceneIds.length - 1;

  async function move(direction: "earlier" | "later") {
    const nextIds = proposeMovedSceneOrder(orderedSceneIds, sceneId, direction);
    const scenes = (nextIds ?? orderedSceneIds).map((id) => ({
      master_id: id,
      canonical_type: "scene",
      parent_master_id: muralId,
    }));
    const decision = decideSceneOrder({
      universe_id: universeId,
      mural_id: muralId,
      ordered_scene_ids: nextIds ?? [],
      scenes,
      mural: { master_id: muralId, canonical_type: "mural", parent_master_id: universeId },
    });
    if (!decision.ok) {
      setSaveError(decision.message);
      return;
    }
    setSaveError(null);
    setBusy(true);
    try {
      await saveSceneOrder(decision.orders);
      setStatus(`${sceneLabel} moved ${direction}.`);
      router.refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Scene order could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="suite-identity-actions">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !canEarlier}
        onClick={() => void move("earlier")}
      >
        Move earlier
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !canLater}
        onClick={() => void move("later")}
      >
        Move later
      </Button>
      {status ? (
        <p className="suite-presence-status" role="status">
          {status}
        </p>
      ) : null}
      {saveError ? (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

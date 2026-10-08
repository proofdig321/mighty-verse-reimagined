"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decideSceneArtwork } from "@/lib/assemble/scene-artwork";
import { muxThumbnailUrl, providerThumbnailUrl } from "@/lib/media/thumbnail";
import { ThumbnailPicker } from "./thumbnail-picker";

async function saveSceneArtwork(input: {
  masterId: string;
  projectionId: string | null;
  thumbnailUrl: string;
}) {
  const response = await fetch("/api/authority/media/artwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      master_id: input.masterId,
      projection_id: input.projectionId,
      thumbnail_url: input.thumbnailUrl,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Scene still could not be saved.");
  }
}

export function SceneArtwork({
  universeId,
  sceneId,
  sceneLabel,
  muralId,
  projectionId,
  provider,
  storageRef,
  startMs,
  artworkStorageRef,
  muxPlaybackId,
  durationMs,
  canAuthor,
  startOpen = false,
  hideTrigger = false,
}: {
  universeId: string;
  sceneId: string;
  sceneLabel: string;
  muralId: string;
  projectionId: string | null;
  provider: string | null;
  storageRef: string | null;
  startMs: number | null;
  artworkStorageRef: string | null;
  muxPlaybackId?: string | null;
  durationMs?: number | null;
  canAuthor: boolean;
  startOpen?: boolean;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const muralFrame =
    storageRef && !storageRef.startsWith("seed:placeholder:")
      ? provider === "mux" || storageRef.startsWith("https://")
        ? storageRef.startsWith("https://")
          ? storageRef
          : muxThumbnailUrl(storageRef, startMs != null ? Math.floor(startMs / 1000) : 0, 640)
        : providerThumbnailUrl(provider, storageRef, {
            timeSec: startMs != null ? Math.floor(startMs / 1000) : 0,
            width: 640,
          })
      : null;

  if (!canAuthor) return null;

  async function persist(url: string) {
    const decision = decideSceneArtwork({
      universe_id: universeId,
      scene_master_id: sceneId,
      thumbnail_url: url,
      scene: { master_id: sceneId, canonical_type: "scene", parent_master_id: muralId },
      mural: { master_id: muralId, canonical_type: "mural", parent_master_id: universeId },
    });
    if (!decision.ok) {
      setSaveError(decision.message);
      return;
    }
    setSaveError(null);
    setBusy(true);
    try {
      await saveSceneArtwork({ masterId: sceneId, projectionId, thumbnailUrl: decision.thumbnail_url });
      setStatus("Still saved");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Scene still could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    if (hideTrigger) {
      return status ? <p className="suite-presence-status" role="status">{status}</p> : null;
    }
    return (
      <div className="suite-identity-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={false}
          onClick={() => { setOpen(true); setStatus(null); setSaveError(null); }}
        >
          Edit still
        </Button>
        {status && <p className="suite-presence-status" role="status">{status}</p>}
      </div>
    );
  }

  return (
    <div className="suite-identity-panel" aria-label={`Edit still for ${sceneLabel}`}>
      <p className="suite-relation-kicker">Which picture stands for this Scene?</p>
      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
      <ThumbnailPicker
        currentUrl={artworkStorageRef ?? muralFrame}
        muxPlaybackId={muxPlaybackId}
        durationMs={durationMs}
        busy={busy}
        label={`Scene ${sceneLabel} still`}
        onPick={(url) => void persist(url)}
        onCancel={() => { setOpen(false); setSaveError(null); }}
      />
    </div>
  );
}

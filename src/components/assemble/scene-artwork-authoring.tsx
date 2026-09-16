"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideSceneArtwork } from "@/lib/assemble/scene-artwork";
import { muxThumbnailUrl, providerThumbnailUrl } from "@/lib/media/thumbnail";

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
  canAuthor,
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
  canAuthor: boolean;
}) {
  const router = useRouter();
  const regionId = useId();
  const stillId = useId();
  const [open, setOpen] = useState(false);
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
  const [nextUrl, setNextUrl] = useState(artworkStorageRef ?? muralFrame ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
      setFieldError(decision.message);
      return;
    }
    setFieldError(null);
    setSaveError(null);
    setBusy(true);
    try {
      await saveSceneArtwork({
        masterId: sceneId,
        projectionId,
        thumbnailUrl: decision.thumbnail_url,
      });
      setStatus("Still saved");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Scene still could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persist(nextUrl);
  }

  if (!open) {
    return (
      <div className="suite-identity-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={false}
          aria-controls={regionId}
          onClick={() => {
            setOpen(true);
            setStatus(null);
            setFieldError(null);
            setSaveError(null);
            setNextUrl(artworkStorageRef ?? muralFrame ?? "");
          }}
        >
          Edit still
        </Button>
        {status ? (
          <p className="suite-presence-status" role="status">
            {status}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="suite-identity-panel"
      id={regionId}
      aria-label={`Edit still for ${sceneLabel}`}
      onSubmit={(event) => void onSubmit(event)}
    >
      <p className="suite-relation-kicker">Which picture stands for this Scene?</p>
      <div className="space-y-2">
        <Label htmlFor={stillId} className="text-xs">
          Still URL
        </Label>
        <Input
          id={stillId}
          name="thumbnail_url"
          value={nextUrl}
          onChange={(event) => {
            setNextUrl(event.target.value);
            if (fieldError) setFieldError(null);
          }}
          placeholder="https://image.mux.com/…/thumbnail.jpg?time=36"
          disabled={busy}
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
        />
        <p className="text-xs text-muted-foreground">
          HTTPS stills only. Use the mural frame at this window, or a gallery still already in Mighty Verse.
        </p>
        {fieldError ? (
          <p role="alert" className="text-xs text-destructive">
            {fieldError}
          </p>
        ) : null}
      </div>
      {saveError ? (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      ) : null}
      <div className="suite-presence-actions">
        {muralFrame ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void persist(muralFrame)}>
            Use mural frame
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save still"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNextUrl(artworkStorageRef ?? muralFrame ?? "");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

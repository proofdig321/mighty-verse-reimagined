"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideSceneTiming } from "@/lib/assemble/scene-timing";
import { formatTimelineMs } from "@/lib/media/timing";

async function saveSceneTiming(input: {
  bindingId: string;
  masterId: string;
  startMs: number;
  endMs: number;
}) {
  const response = await fetch("/api/authority/media/timeline", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      binding_id: input.bindingId,
      master_id: input.masterId,
      start_ms: input.startMs,
      end_ms: input.endMs,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Scene timing could not be saved.");
  }
}

export function SceneTiming({
  universeId,
  sceneId,
  sceneLabel,
  muralId,
  bindingId,
  startMs,
  endMs,
  canAuthor,
}: {
  universeId: string;
  sceneId: string;
  sceneLabel: string;
  muralId: string;
  bindingId: string | null;
  startMs: number | null;
  endMs: number | null;
  canAuthor: boolean;
}) {
  const router = useRouter();
  const regionId = useId();
  const startId = useId();
  const endId = useId();
  const [open, setOpen] = useState(false);
  const [nextStart, setNextStart] = useState(startMs != null ? formatTimelineMs(startMs) : "");
  const [nextEnd, setNextEnd] = useState(endMs != null ? formatTimelineMs(endMs) : "");
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

  if (!canAuthor || !bindingId) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = decideSceneTiming({
      universe_id: universeId,
      scene_master_id: sceneId,
      binding_id: bindingId,
      start_ms: nextStart,
      end_ms: nextEnd,
      scene: { master_id: sceneId, canonical_type: "scene", parent_master_id: muralId },
      mural: { master_id: muralId, canonical_type: "mural", parent_master_id: universeId },
      binding: bindingId
        ? { binding_id: bindingId, projection_id: sceneId, master_id: sceneId }
        : null,
    });
    if (!decision.ok) {
      setFieldError(decision.message);
      return;
    }
    setFieldError(null);
    setSaveError(null);
    setBusy(true);
    try {
      await saveSceneTiming({
        bindingId: decision.binding_id,
        masterId: sceneId,
        startMs: decision.start_ms,
        endMs: decision.end_ms,
      });
      setStatus(`${formatTimelineMs(decision.start_ms)} → ${formatTimelineMs(decision.end_ms)}`);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Scene timing could not be saved.");
    } finally {
      setBusy(false);
    }
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
            setNextStart(startMs != null ? formatTimelineMs(startMs) : "");
            setNextEnd(endMs != null ? formatTimelineMs(endMs) : "");
          }}
        >
          Edit timing
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
      aria-label={`Edit timing for ${sceneLabel}`}
      onSubmit={(event) => void onSubmit(event)}
    >
      <p className="suite-relation-kicker">When does this Scene live on the Mural?</p>
      <div className="space-y-2">
        <Label htmlFor={startId} className="text-xs">
          Window start
        </Label>
        <Input
          id={startId}
          name="start_ms"
          value={nextStart}
          onChange={(event) => {
            setNextStart(event.target.value);
            if (fieldError) setFieldError(null);
          }}
          placeholder="0:36.000"
          disabled={busy}
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${startId}-error` : `${startId}-hint`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={endId} className="text-xs">
          Window end
        </Label>
        <Input
          id={endId}
          name="end_ms"
          value={nextEnd}
          onChange={(event) => {
            setNextEnd(event.target.value);
            if (fieldError) setFieldError(null);
          }}
          placeholder="1:19.000"
          disabled={busy}
          autoComplete="off"
        />
        <p id={`${startId}-hint`} className="text-xs text-muted-foreground">
          Use 0:36.000, 0:36, or milliseconds. This shapes the existing window. Sentinel still creates Scenes.
        </p>
        {fieldError ? (
          <p id={`${startId}-error`} role="alert" className="text-xs text-destructive">
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
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save timing"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNextStart(startMs != null ? formatTimelineMs(startMs) : "");
            setNextEnd(endMs != null ? formatTimelineMs(endMs) : "");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

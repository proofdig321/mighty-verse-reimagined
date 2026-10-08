"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideSceneTiming } from "@/lib/assemble/scene-timing";
import { formatOperatorSeconds, parseOperatorSeconds, formatTimelineMs } from "@/lib/media/timing";

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

/** Compact scrubber — shows mural duration as a range with start/end handles */
function TimingScrubber({
  startSec,
  endSec,
  durationSec,
  muxPlaybackId,
  onStartChange,
  onEndChange,
}: {
  startSec: number;
  endSec: number;
  durationSec: number;
  muxPlaybackId: string;
  onStartChange: (s: number) => void;
  onEndChange: (s: number) => void;
}) {
  const startPct = durationSec > 0 ? (startSec / durationSec) * 100 : 0;
  const endPct = durationSec > 0 ? (endSec / durationSec) * 100 : 100;
  const thumbUrl = (sec: number) =>
    `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?time=${Math.round(sec)}&width=160`;

  return (
    <div className="scene-timing-scrubber">
      {/* Visual bar */}
      <div className="scene-timing-bar">
        <div
          className="scene-timing-window"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
      </div>
      {/* Start handle */}
      <div className="scene-timing-handle-row">
        <div className="scene-timing-handle-group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl(startSec)} alt="" className="scene-timing-thumb" />
          <label className="text-[10px] text-muted-foreground">Start</label>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.5}
            value={startSec}
            className="scene-timing-range accent-primary"
            aria-label="Scene start"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v < endSec) onStartChange(v);
            }}
          />
        </div>
        <div className="scene-timing-handle-group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl(endSec)} alt="" className="scene-timing-thumb" />
          <label className="text-[10px] text-muted-foreground">End</label>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.5}
            value={endSec}
            className="scene-timing-range accent-primary"
            aria-label="Scene end"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > startSec) onEndChange(v);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function SceneTiming({
  universeId,
  sceneId,
  sceneLabel,
  muralId,
  bindingId,
  startMs,
  endMs,
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
  bindingId: string | null;
  startMs: number | null;
  endMs: number | null;
  muxPlaybackId?: string | null;
  durationMs?: number | null;
  canAuthor: boolean;
  startOpen?: boolean;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const regionId = useId();
  const startId = useId();
  const endId = useId();
  const [open, setOpen] = useState(startOpen);

  // Seconds — the only unit shown to the user
  const [startSec, setStartSec] = useState(startMs != null ? startMs / 1000 : 0);
  const [endSec, setEndSec] = useState(endMs != null ? endMs / 1000 : 0);
  const [startRaw, setStartRaw] = useState(startMs != null ? formatOperatorSeconds(startMs) : "");
  const [endRaw, setEndRaw] = useState(endMs != null ? formatOperatorSeconds(endMs) : "");

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const durationSec = durationMs ? durationMs / 1000 : 300;
  const hasScrubber = Boolean(muxPlaybackId);

  if (!canAuthor) return null;

  if (!bindingId) {
    return (
      <div className="suite-identity-actions">
        <Button type="button" variant="outline" size="sm" disabled>
          Edit timing
        </Button>
        <p className="suite-presence-status">
          No media window yet. Bind mural media first.
        </p>
      </div>
    );
  }

  function syncFromScrubber(newStartSec: number, newEndSec: number) {
    setStartSec(newStartSec);
    setEndSec(newEndSec);
    setStartRaw(String(Number(newStartSec.toFixed(1))));
    setEndRaw(String(Number(newEndSec.toFixed(1))));
    setFieldError(null);
  }

  async function handleSave() {
    const startParsed = parseOperatorSeconds(startRaw);
    const endParsed = parseOperatorSeconds(endRaw);
    if (startParsed == null || endParsed == null) {
      setFieldError("Enter start and end in seconds (e.g. 36 or 36.5).");
      return;
    }
    const decision = decideSceneTiming({
      universe_id: universeId,
      scene_master_id: sceneId,
      binding_id: bindingId,
      start_ms: startParsed,
      end_ms: endParsed,
      scene: { master_id: sceneId, canonical_type: "scene", parent_master_id: muralId },
      mural: { master_id: muralId, canonical_type: "mural", parent_master_id: universeId },
      binding: { binding_id: bindingId!, projection_id: sceneId, master_id: sceneId },
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
          aria-controls={regionId}
          onClick={() => {
            setOpen(true);
            setStatus(null);
            setFieldError(null);
            setSaveError(null);
            setStartSec(startMs != null ? startMs / 1000 : 0);
            setEndSec(endMs != null ? endMs / 1000 : 0);
            setStartRaw(startMs != null ? formatOperatorSeconds(startMs) : "");
            setEndRaw(endMs != null ? formatOperatorSeconds(endMs) : "");
          }}
        >
          Edit timing
        </Button>
        {status && <p className="suite-presence-status" role="status">{status}</p>}
      </div>
    );
  }

  return (
    <div className="suite-identity-panel" id={regionId} aria-label={`Edit timing for ${sceneLabel}`}>
      <p className="suite-relation-kicker">When does this Scene live on the Mural?</p>

      {hasScrubber && (
        <TimingScrubber
          startSec={startSec}
          endSec={endSec}
          durationSec={durationSec}
          muxPlaybackId={muxPlaybackId!}
          onStartChange={(s) => syncFromScrubber(s, endSec)}
          onEndChange={(e) => syncFromScrubber(startSec, e)}
        />
      )}

      <div className="scene-timing-fields">
        <div className="space-y-1">
          <Label htmlFor={startId} className="text-xs">Start (seconds)</Label>
          <Input
            id={startId}
            type="number"
            min={0}
            step={0.5}
            value={startRaw}
            onChange={(e) => {
              setStartRaw(e.target.value);
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setStartSec(v);
              setFieldError(null);
            }}
            placeholder="36"
            disabled={busy}
            autoComplete="off"
            aria-invalid={fieldError ? true : undefined}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={endId} className="text-xs">End (seconds)</Label>
          <Input
            id={endId}
            type="number"
            min={0}
            step={0.5}
            value={endRaw}
            onChange={(e) => {
              setEndRaw(e.target.value);
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setEndSec(v);
              setFieldError(null);
            }}
            placeholder="79"
            disabled={busy}
            autoComplete="off"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Enter seconds. Storage stays milliseconds — no conversion needed.
      </p>

      {fieldError && <p role="alert" className="text-xs text-destructive">{fieldError}</p>}
      {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}

      <div className="suite-presence-actions">
        <Button type="button" size="sm" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "Saving…" : "Save timing"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setStartRaw(startMs != null ? formatOperatorSeconds(startMs) : "");
            setEndRaw(endMs != null ? formatOperatorSeconds(endMs) : "");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideCreativeMomentIdentity } from "@/lib/assemble/creative-moment-identity";

async function saveCreativeMomentIdentity(input: {
  masterId: string;
  title: string;
  description: string | null;
}) {
  const response = await fetch("/api/authority/presentation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      master_id: input.masterId,
      title: input.title,
      description: input.description,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Creative Moment identity could not be saved.");
  }
}

export function CreativeMomentIdentity({
  universeId,
  momentId,
  momentLabel,
  title,
  description,
  canAuthor,
}: {
  universeId: string;
  momentId: string;
  momentLabel: string;
  title: string;
  description: string;
  canAuthor: boolean;
}) {
  const router = useRouter();
  const regionId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);
  const [nextDescription, setNextDescription] = useState(description);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const decision = decideCreativeMomentIdentity({
      universe_id: universeId,
      moment_master_id: momentId,
      title: nextTitle,
      description: nextDescription,
      moment: { master_id: momentId, canonical_type: "creative-moment", parent_master_id: universeId },
    });
    if (!decision.ok) {
      setFieldError(decision.message);
      return;
    }
    setFieldError(null);
    setSaveError(null);
    setBusy(true);
    try {
      await saveCreativeMomentIdentity({
        masterId: momentId,
        title: decision.identity.title,
        description: decision.identity.description,
      });
      setStatus(`${decision.identity.title} is named.`);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Creative Moment identity could not be saved.");
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
            setNextTitle(title);
            setNextDescription(description);
          }}
        >
          Edit identity
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
      aria-label={`Edit identity for ${momentLabel}`}
      onSubmit={(event) => void onSubmit(event)}
    >
      <p className="suite-relation-kicker">What is this Creative Moment called?</p>
      <div className="space-y-2">
        <Label htmlFor={titleId} className="text-xs">
          Creative Moment name
        </Label>
        <Input
          id={titleId}
          name="title"
          value={nextTitle}
          onChange={(event) => {
            setNextTitle(event.target.value);
            if (fieldError) setFieldError(null);
          }}
          placeholder="Proverb"
          disabled={busy}
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${titleId}-error` : `${titleId}-hint`}
        />
        <p id={`${titleId}-hint`} className="text-xs text-muted-foreground">
          Canonical name for this contributor-centred unit. Presence and Experience stay as they are.
        </p>
        {fieldError ? (
          <p id={`${titleId}-error`} role="alert" className="text-xs text-destructive">
            {fieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={descriptionId} className="text-xs">
          How this Creative Moment is introduced
        </Label>
        <Textarea
          id={descriptionId}
          name="description"
          value={nextDescription}
          onChange={(event) => setNextDescription(event.target.value)}
          placeholder="What this Creative Moment is in the Universe"
          disabled={busy}
          rows={3}
          className="min-h-16"
          aria-describedby={`${descriptionId}-hint`}
        />
        <p id={`${descriptionId}-hint`} className="text-xs text-muted-foreground">
          Optional. Identity only — presence, projections, and media stay as they are.
        </p>
      </div>
      {saveError ? (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      ) : null}
      <div className="suite-presence-actions">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save identity"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNextTitle(title);
            setNextDescription(description);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CurateContinuationLinks } from "./curate-continuation";

/**
 * Contextual Creative Moment registration for an existing Universe.
 * Reuses Create Work primitives (master → state → projection). Not a second wizard.
 */
export function RegisterCreativeMoment({
  universeId,
  universeTitle,
}: {
  universeId: string;
  universeTitle: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);

  const workName = universeTitle ?? "this Universe";

  async function confirm() {
    const momentTitle = title.trim();
    if (!momentTitle) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const masterRes = await fetch("/api/authority/masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_type: "creative-moment",
          parent_master_id: universeId,
          title: momentTitle,
        }),
      });
      const masterPayload = await masterRes.json().catch(() => ({}));
      if (!masterRes.ok) {
        throw new Error(
          typeof masterPayload.error === "string"
            ? masterPayload.error
            : "Creative Moment could not be registered.",
        );
      }

      const stateRes = await fetch("/api/authority/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ master_id: masterPayload.master_id }),
      });
      const statePayload = await stateRes.json().catch(() => ({}));
      if (!stateRes.ok) {
        throw new Error(
          typeof statePayload.error === "string" ? statePayload.error : "Canonical state failed.",
        );
      }

      const projRes = await fetch("/api/authority/projections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_state_id: statePayload.canonical_state_id,
          master_id: masterPayload.master_id,
          projection_type: "experiential",
        }),
      });
      const projPayload = await projRes.json().catch(() => ({}));
      if (!projRes.ok) {
        throw new Error(
          typeof projPayload.error === "string" ? projPayload.error : "Projection failed.",
        );
      }

      setResultId(masterPayload.master_id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creative Moment could not be registered.");
    } finally {
      setBusy(false);
    }
  }

  if (resultId) {
    return (
      <div className="space-y-2" role="status">
        <p className="text-xs text-foreground">
          Creative Moment registered on {workName}. Place it in Scenes from Creative Studio.
        </p>
        <CurateContinuationLinks universeId={universeId} muralRegistered mediaAttached={false} />
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Add Creative Moment
      </Button>
    );
  }

  return (
    <form
      className="max-w-lg space-y-3"
      aria-label="Register Creative Moment"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm text-foreground">
        Register a Creative Moment on {workName}. It is parented to the Universe, not owned by the
        Mural. Scene presence is authored later in Creative Studio.
      </p>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Creative Moment title"
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-1.5 text-sm"
          autoFocus
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Registering…" : "Confirm register Creative Moment"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

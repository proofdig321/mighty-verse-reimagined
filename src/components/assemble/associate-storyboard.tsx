"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function AssociateStoryboard({
  universes,
  value,
  onChange,
}: {
  universes: { master_id: string; title: string }[];
  value?: string;
  onChange?: (universeId: string) => void;
}) {
  const router = useRouter();
  const [internalId, setInternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const universeId = value ?? internalId;

  function setUniverseId(next: string) {
    if (onChange) onChange(next);
    else setInternalId(next);
  }

  async function confirm() {
    if (!universeId) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, action: "associate" }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Association could not be completed.");
      return;
    }
    router.push(`/authority/universes/${universeId}/storyboard`);
  }

  return (
    <form
      className="storyboard-target"
      aria-label="Target Association"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <div className="storyboard-target-field">
        <Label htmlFor="associate-storyboard-universe">Target Association</Label>
        <select
          id="associate-storyboard-universe"
          aria-label="Target Association"
          value={universeId}
          disabled={busy}
          onChange={(event) => setUniverseId(event.target.value)}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Independent / Standalone Project</option>
          {universes.map((universe) => (
            <option key={universe.master_id} value={universe.master_id}>
              {universe.title}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        Work stays independent until you attach it. Attachment does not create Scenes or change canonical timing.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {universeId ? (
        <Button type="submit" size="sm" disabled={busy}>
          Publish / Attach to Canonical Universe
        </Button>
      ) : null}
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function AssociateStoryboard({
  universes,
}: {
  universes: { master_id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [universeId, setUniverseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Associate with Universe
      </Button>
    );
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
      className="max-w-sm space-y-3"
      aria-label="Associate storyboard with Universe"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="associate-storyboard-universe">Canonical work</Label>
        <select
          id="associate-storyboard-universe"
          aria-label="Select Universe to associate"
          value={universeId}
          disabled={busy}
          onChange={(event) => setUniverseId(event.target.value)}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select an existing Universe…</option>
          {universes.map((universe) => (
            <option key={universe.master_id} value={universe.master_id}>
              {universe.title}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        This attaches the creative artifact to the Universe. It does not create Scenes or change canonical timing.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !universeId}>
          {busy ? "Associating…" : "Confirm association"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

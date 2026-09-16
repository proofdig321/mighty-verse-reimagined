"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DiscardIntake({
  intakeId,
  title,
  onDiscarded,
}: {
  intakeId: string;
  title: string;
  onDiscarded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const name = title.trim() || "this intake";

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/authority/media-intake/${intakeId}/discard`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Intake could not be removed.");
      return;
    }
    setDone(true);
    onDiscarded?.();
    router.refresh();
  }

  if (done) {
    return (
      <p role="status" className="text-xs text-foreground">
        {name} is removed from Gallery. Records stay.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
    );
  }

  return (
    <form
      className="max-w-sm space-y-2"
      aria-label="Delete intake"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-xs text-foreground">
        Remove {name} from Gallery. This does not delete a Universe. Duplicate awaiting-upload shells can be discarded.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={busy}>
          {busy ? "Removing…" : "Confirm delete"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DiscardMedia({
  assetId,
  title,
}: {
  assetId: string;
  title: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const name = title ?? "this media";

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/authority/media/${assetId}/discard`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Media could not be removed.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p role="status" className="text-xs text-foreground">
        {name} is removed from Incoming. Records stay.
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
      aria-label="Delete media"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-xs text-foreground">
        Remove {name} from Incoming. This does not delete a Universe. Canonical Super Hero Ego and Father Raymond media stay.
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

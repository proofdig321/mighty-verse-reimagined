"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { UniverseOccupancy } from "@/lib/assemble/occupancy";

export function WithdrawWork({
  masterId,
  title,
  layout = "inline",
  actionLabel = "Withdraw",
  occupancy = null,
}: {
  masterId: string;
  title: string | null;
  layout?: "inline" | "panel";
  actionLabel?: string;
  occupancy?: UniverseOccupancy | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const workName = title ?? "this work";
  const isOrphan = occupancy === "orphan";
  const buttonLabel = actionLabel !== "Withdraw" ? actionLabel : isOrphan ? "Remove orphan" : "Withdraw";

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/masters/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ master_id: masterId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Withdraw could not be completed.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p role="status" className="text-xs text-foreground">
        {workName} is withdrawn from Discover. Records are preserved.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
    );
  }

  return (
    <form
      className={layout === "panel" ? "max-w-lg space-y-3" : "max-w-sm space-y-3"}
      aria-label="Withdraw work"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm text-foreground">
        {isOrphan
          ? `Remove orphan ${workName} from operator catalogues. This is an Authority withdraw, not a CMS hard-delete. Super Hero Ego cannot be withdrawn.`
          : `Withdraw ${workName} from Discover. This is an Authority act, not a delete. Super Hero Ego cannot be withdrawn.`}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={busy}>
          {busy ? (isOrphan ? "Removing…" : "Withdrawing…") : isOrphan ? "Confirm remove" : "Confirm withdraw"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

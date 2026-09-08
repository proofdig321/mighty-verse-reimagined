"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CREATE_WORK_HREF } from "@/lib/assemble/association";
import { creativeSuiteHref } from "@/lib/assemble/studio";

export function RegisterMural({
  universeId,
  universeTitle,
  layout = "panel",
  fromCurate = false,
}: {
  universeId: string;
  universeTitle: string | null;
  layout?: "panel" | "inline";
  fromCurate?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    registration: string;
    mural_id: string;
  } | null>(null);

  const workName = universeTitle ?? "this Universe";

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/authority/murals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(
        typeof payload.error === "string"
          ? payload.error
          : "Mural could not be registered.",
      );
      return;
    }
    setResult({
      registration: payload.registration ?? "registered",
      mural_id: payload.mural_id,
    });
    router.refresh();
  }

  if (result) {
    const already = result.registration === "already_registered";
    return (
      <div className="space-y-2" role="status">
        <p className="text-xs text-foreground">
          {already
            ? `${workName} already has its Mural. Continue in Creative Suite.`
            : `Mural registered for ${workName}. Media is not attached.`}
        </p>
        <Link
          href={creativeSuiteHref(universeId, fromCurate ? "curate" : null)}
          className="text-xs text-foreground hover:underline"
        >
          Open Creative Suite
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant={layout === "inline" ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
        Register Mural
      </Button>
    );
  }

  return (
    <form
      className={layout === "inline" ? "max-w-sm space-y-3 text-left" : "max-w-lg space-y-3"}
      aria-label="Register Mural"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm text-foreground">
        You are registering a Mural for {workName}. This establishes the audiovisual
        container. It does not attach media, create Scenes, or publish Experience.
      </p>
      {layout === "panel" && (
        <p className="text-xs text-muted-foreground">
          Create Work remains a broader Authority path if you need media during creation.{" "}
          <Link href={CREATE_WORK_HREF} className="underline">
            Open Create Work
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Registering…" : "Confirm register Mural"}
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

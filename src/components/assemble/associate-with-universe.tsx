"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CREATE_WORK_HREF,
  decideCanonicalAssociation,
  mediaAssociationEligibility,
} from "@/lib/assemble/association";
import { creativeSuiteHref, type CurateStudioMedia } from "@/lib/assemble/studio";
import type { CurateStudioUniverse } from "@/lib/assemble/load-studio";
import { RegisterMural } from "./register-mural";

export function AssociateWithUniverse({
  media,
  universes,
}: {
  media: CurateStudioMedia;
  universes: CurateStudioUniverse[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [universeId, setUniverseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [associatedUniverseId, setAssociatedUniverseId] = useState<string | null>(
    media.association.universe_id,
  );

  const eligibility = mediaAssociationEligibility({
    readiness_overall: media.readiness_overall,
    readiness_blockers: media.readiness_blockers,
  });
  const selected = universes.find((universe) => universe.master_id === universeId) ?? null;
  const compatible = universes.filter((universe) => universe.target.compatible);
  const decision = decideCanonicalAssociation({
    assetId: media.asset_id,
    universeId: universeId || null,
    eligibility,
    target: selected?.target ?? null,
  });

  async function confirm() {
    if (!universeId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/authority/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: media.asset_id, universe_id: universeId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Association could not be completed.");
      return;
    }
    setAssociatedUniverseId(universeId);
    setMessage(
      payload.already_associated
        ? "This media is already associated with that Universe. Continue in Creative Suite."
        : "Associated. Continue in Creative Suite.",
    );
    router.refresh();
  }

  if (associatedUniverseId) {
    return (
      <Link href={creativeSuiteHref(associatedUniverseId, "curate")} className="text-xs text-foreground hover:underline">
        Open Creative Suite
      </Link>
    );
  }

  if (!eligibility.eligible) {
    return (
      <p className="text-xs text-muted-foreground" title={eligibility.reasons.join(". ")}>
        {eligibility.reasons[0] ?? "Not ready to associate"}
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Associate with Universe
      </Button>
    );
  }

  return (
    <form
      className="max-w-sm space-y-3 text-left"
      aria-label="Associate media with Universe"
      onSubmit={(event) => {
        event.preventDefault();
        if (decision.ok && decision.action === "bind") void confirm();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`associate-universe-${media.asset_id}`}>Canonical work</Label>
        <select
          id={`associate-universe-${media.asset_id}`}
          aria-label="Select Universe to associate"
          value={universeId}
          disabled={busy}
          onChange={(event) => {
            setUniverseId(event.target.value);
            setError(null);
            setMessage(null);
          }}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select an existing Universe…</option>
          {universes.map((universe) => (
            <option key={universe.master_id} value={universe.master_id}>
              {universe.title ?? "Untitled universe"}
              {universe.target.compatible ? "" : " — no compatible Mural"}
            </option>
          ))}
        </select>
      </div>

      {compatible.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No compatible canonical work available.{" "}
          <Link href={CREATE_WORK_HREF} className="underline">
            Create Work
          </Link>{" "}
          is a separate operation. Uploading media does not create a Universe.
        </p>
      )}

      {selected && (
        <p className="text-xs text-muted-foreground">
          {selected.target.compatible
            ? `This associates the media with ${selected.title ?? "this Universe"} by binding it to the existing Mural ${selected.target.mural_title ?? "for that work"}. It does not create a Universe.`
            : selected.target.blocked_reason === "no_mural"
              ? "This Universe has no Mural yet. Association does not create one. Register the Mural first."
              : "This Universe's Mural has no presentation to receive media yet. Register the Mural presentation first."}
        </p>
      )}

      {decision.ok === false && universeId && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {decision.message}
          </p>
          {(decision.code === "no_mural" || decision.code === "no_projection") && (
            <RegisterMural
              universeId={selected?.master_id ?? universeId}
              universeTitle={selected?.title ?? null}
              layout="inline"
              fromCurate
            />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-foreground">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !decision.ok || decision.action !== "bind"}>
          {busy ? "Associating…" : "Confirm association"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
            setMessage(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

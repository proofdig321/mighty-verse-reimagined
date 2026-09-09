"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { PresenceOption } from "@/lib/assemble/presence";

type PresenceKind = "scene" | "moment";

async function relatePresence(input: {
  universeId: string;
  sceneId: string;
  momentId: string;
}) {
  const response = await fetch("/api/authority/scene-moment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      universe_id: input.universeId,
      scene_master_id: input.sceneId,
      moment_master_id: input.momentId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Presence could not be added.");
  }
  return payload as { already?: boolean };
}

async function unrelatePresence(input: {
  universeId: string;
  sceneId: string;
  momentId: string;
}) {
  const params = new URLSearchParams({
    universe_id: input.universeId,
    scene_master_id: input.sceneId,
    moment_master_id: input.momentId,
  });
  const response = await fetch(`/api/authority/scene-moment?${params.toString()}`, {
    method: "DELETE",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Presence could not be removed.");
  }
}

function optionLabel(option: PresenceOption, kind: PresenceKind) {
  if (kind === "moment") return option.title?.trim() || "Untitled Creative Moment";
  return sceneShortTitle(option.title) ?? (option.title?.trim() || "Untitled scene");
}

export function ScenePresence({
  universeId,
  sceneId,
  sceneLabel,
  related,
  candidates,
  sharedIds,
  canAuthor,
}: {
  universeId: string;
  sceneId: string;
  sceneLabel: string;
  related: PresenceOption[];
  candidates: PresenceOption[];
  sharedIds: string[];
  canAuthor: boolean;
}) {
  const shared = new Set(sharedIds);
  return (
    <div className="suite-presence">
      {related.length > 0 ? (
        <>
          <p className="suite-relation-kicker">
            Related Creative Moment{related.length === 1 ? "" : "s"}
            {related.some((item) => shared.has(item.master_id)) ? " · shared" : ""}
          </p>
          <ul className="suite-presence-list">
            {related.map((moment) => (
              <li key={moment.master_id} className="suite-presence-item">
                <Link href={`#universe-moment-${moment.master_id}`} className="suite-relation-link">
                  {optionLabel(moment, "moment")}
                </Link>
                {canAuthor ? (
                  <PresenceRemove
                    universeId={universeId}
                    sceneId={sceneId}
                    momentId={moment.master_id}
                    sceneLabel={sceneLabel}
                    momentLabel={optionLabel(moment, "moment")}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="suite-scene-moment italic text-muted-foreground/70">No Creative Moment related</p>
      )}
      {canAuthor ? (
        <PresenceAdd
          kind="scene"
          universeId={universeId}
          sceneId={sceneId}
          hostLabel={sceneLabel}
          candidates={candidates}
        />
      ) : null}
    </div>
  );
}

export function MomentPresence({
  universeId,
  momentId,
  momentLabel,
  related,
  candidates,
  canAuthor,
}: {
  universeId: string;
  momentId: string;
  momentLabel: string;
  related: PresenceOption[];
  candidates: PresenceOption[];
  canAuthor: boolean;
}) {
  return (
    <div className="suite-presence">
      {related.length > 0 ? (
        <div className="suite-moment-scenes">
          <p className="suite-relation-kicker">
            Related Scene{related.length === 1 ? "" : "s"}
          </p>
          <ul className="suite-presence-list">
            {related.map((scene) => (
              <li key={scene.master_id} className="suite-presence-item">
                <Link href={`/authority/universes/${universeId}/scenes/${scene.master_id}`} className="suite-relation-link">
                  {optionLabel(scene, "scene")}
                </Link>
                {canAuthor ? (
                  <PresenceRemove
                    universeId={universeId}
                    sceneId={scene.master_id}
                    momentId={momentId}
                    sceneLabel={optionLabel(scene, "scene")}
                    momentLabel={momentLabel}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="italic text-muted-foreground/70 text-sm">No Scene relation</p>
      )}
      {canAuthor ? (
        <PresenceAdd
          kind="moment"
          universeId={universeId}
          momentId={momentId}
          hostLabel={momentLabel}
          candidates={candidates}
        />
      ) : null}
    </div>
  );
}

function PresenceAdd({
  kind,
  universeId,
  sceneId,
  momentId,
  hostLabel,
  candidates,
}: {
  kind: PresenceKind;
  universeId: string;
  sceneId?: string;
  momentId?: string;
  hostLabel: string;
  candidates: PresenceOption[];
}) {
  const router = useRouter();
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function add(option: PresenceOption) {
    const nextSceneId = kind === "scene" ? sceneId : option.master_id;
    const nextMomentId = kind === "moment" ? momentId : option.master_id;
    if (!nextSceneId || !nextMomentId) return;
    setBusyId(option.master_id);
    setError(null);
    try {
      const result = await relatePresence({
        universeId,
        sceneId: nextSceneId,
        momentId: nextMomentId,
      });
      const label = optionLabel(option, kind === "scene" ? "moment" : "scene");
      setStatus(
        result.already
          ? `${label} is already present.`
          : kind === "scene"
            ? `${label} is now present in ${hostLabel}.`
            : `${hostLabel} is now present in ${label}.`,
      );
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Presence could not be added.");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) {
    return (
      <div className="suite-presence-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={false}
          aria-controls={regionId}
          onClick={() => {
            setOpen(true);
            setStatus(null);
          }}
        >
          Add presence
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
    <div className="suite-presence-panel" id={regionId} role="region" aria-label={`Add presence to ${hostLabel}`}>
      <p className="suite-relation-kicker">
        {kind === "scene" ? `Who is present in ${hostLabel}?` : `Where is ${hostLabel} present?`}
      </p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {kind === "scene"
            ? "Every Creative Moment in this Universe is already present here."
            : "This Creative Moment is already present in every Scene."}
        </p>
      ) : (
        <ul className="suite-presence-choices">
          {candidates.map((option) => (
            <li key={option.master_id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId != null}
                aria-label={
                  kind === "scene"
                    ? `Add ${optionLabel(option, "moment")} to ${hostLabel}`
                    : `Add ${hostLabel} to ${optionLabel(option, "scene")}`
                }
                onClick={() => void add(option)}
              >
                {busyId === option.master_id ? "Adding…" : optionLabel(option, kind === "scene" ? "moment" : "scene")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="ghost" size="sm" disabled={busyId != null} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function PresenceRemove({
  universeId,
  sceneId,
  momentId,
  sceneLabel,
  momentLabel,
}: {
  universeId: string;
  sceneId: string;
  momentId: string;
  sceneLabel: string;
  momentLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await unrelatePresence({ universeId, sceneId, momentId });
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Presence could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={`Remove ${momentLabel} from ${sceneLabel}`}
        onClick={() => setConfirming(true)}
      >
        Remove presence
      </Button>
    );
  }

  return (
    <div className="suite-presence-confirm" role="group" aria-label={`Confirm remove ${momentLabel} from ${sceneLabel}`}>
      <p className="text-xs text-foreground">
        Remove {momentLabel} from {sceneLabel}? This only removes presence. The Creative Moment and Scene stay.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div className="suite-presence-actions">
        <Button type="button" variant="destructive" size="xs" disabled={busy} onClick={() => void confirm()}>
          {busy ? "Removing…" : "Confirm remove presence"}
        </Button>
        <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

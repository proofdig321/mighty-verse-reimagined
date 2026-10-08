"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sceneStillUrl } from "@/lib/assemble/composition";
import { formatTimelineMs } from "@/lib/media/timing";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import type { UniverseAssemblyMural } from "@/lib/assemble";
import { CreativeStill } from "./creative-still";
import { ThumbnailPicker } from "./thumbnail-picker";

function CanonicalIdentifiers({ items }: { items: { label: string; value: string }[] }) {
  return (
    <details className="suite-identifiers">
      <summary>Canonical identifiers</summary>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd className="font-mono break-all">{item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

async function saveMuralArtwork(masterId: string, thumbnailUrl: string) {
  const res = await fetch("/api/authority/media/artwork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ master_id: masterId, thumbnail_url: thumbnailUrl }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Thumbnail could not be saved.");
}

function MuralThumbnailEditor({
  mural,
  defaultUrl,
}: {
  mural: UniverseAssemblyMural;
  defaultUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Derive Mux playback ID from storage_ref if provider is mux
  const muxPlaybackId =
    mural.provider === "mux" && mural.storage_ref && !mural.storage_ref.startsWith("seed:")
      ? mural.storage_ref
      : null;

  // Estimate duration from scenes
  const durationMs = mural.scenes.reduce((max, s) => Math.max(max, s.end_ms ?? 0), 0) || null;

  async function handlePick(url: string) {
    setError(null);
    setBusy(true);
    try {
      await saveMuralArtwork(mural.master_id, url);
      setStatus("Thumbnail saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save thumbnail.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="suite-identity-actions">
        <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(true); setError(null); }}>
          Edit thumbnail
        </Button>
        {status && <p className="suite-presence-status" role="status">{status}</p>}
      </div>
    );
  }

  return (
    <div className="suite-identity-panel">
      <p className="suite-relation-kicker">Mural thumbnail</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <ThumbnailPicker
        currentUrl={mural.artwork_storage_ref ?? defaultUrl}
        muxPlaybackId={muxPlaybackId}
        durationMs={durationMs}
        busy={busy}
        label="mural thumbnail"
        onPick={(url) => void handlePick(url)}
        onCancel={() => { setOpen(false); setError(null); }}
      />
    </div>
  );
}

export function MuralPresence({
  mural,
  openHref,
  openLabel,
  canAuthor = false,
}: {
  mural: UniverseAssemblyMural;
  openHref: string;
  openLabel: string;
  canAuthor?: boolean;
}) {
  const timedScenes = mural.scenes.filter((scene) => scene.start_ms != null && scene.end_ms != null);
  const startMs = timedScenes.length ? Math.min(...timedScenes.map((scene) => scene.start_ms as number)) : null;
  const endMs = timedScenes.length ? Math.max(...timedScenes.map((scene) => scene.end_ms as number)) : null;
  const presenceTime = mural.scenes.find((scene) => scene.start_ms != null)?.start_ms ?? 5000;
  const still = sceneStillUrl({
    provider: mural.provider,
    storage_ref: mural.storage_ref,
    start_ms: presenceTime,
    artwork_storage_ref: mural.artwork_storage_ref,
  });
  const stillUrl = still
    ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 1280 })
    : null;
  const derivedFrame = sceneStillUrl({ provider: mural.provider, storage_ref: mural.storage_ref, start_ms: presenceTime });
  const derivedFrameUrl = derivedFrame
    ? providerThumbnailUrl(derivedFrame.provider, derivedFrame.storage_ref, { timeSec: derivedFrame.timeSec, width: 640 })
    : null;
  const title = mural.title?.trim() || "Untitled mural";
  const headingId = `universe-mural-heading-${mural.master_id}`;
  const sceneCount = mural.scenes.length;

  return (
    <article className="suite-mural-presence" aria-labelledby={headingId}>
      <div className="suite-mural-stage">
        <CreativeStill url={stillUrl} alt="" />
        <div className="suite-mural-stage-copy">
          <p className="suite-kicker">Stage</p>
          <h3 id={headingId} className="suite-mural-title">
            <span className="sr-only">Mural. </span>
            {title}
          </h3>
          <p className="suite-mural-role">The audiovisual expression of this Universe.</p>
        </div>
      </div>
      <div className="suite-mural-meta">
        <p>
          {sceneCount} Scene{sceneCount === 1 ? "" : "s"}
          {startMs != null && endMs != null ? ` · ${formatTimelineMs(startMs)} → ${formatTimelineMs(endMs)}` : ""}
        </p>
        {mural.has_media ? (
          <p>Canonical media is bound to this Mural. Studio source preview is the authoring player. Public mural playback remains Experience.</p>
        ) : (
          <p>Mural container is registered. No audiovisual media is bound yet.</p>
        )}
        <div className="suite-object-actions">
          <Link href={openHref} className="suite-open-link">
            {openLabel}
            <span className="sr-only"> for mural {title}</span>
          </Link>
          <Link href={`/worlds/${mural.master_id}`} className="suite-open-link">
            View mural experience
          </Link>
        </div>
        {canAuthor && (
          <MuralThumbnailEditor mural={mural} defaultUrl={derivedFrameUrl} />
        )}
        <CanonicalIdentifiers items={[{ label: "Master", value: mural.master_id }]} />
      </div>
    </article>
  );
}

export function MuralEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="suite-mural-empty">
      <p>No mural assembled for this Universe yet.</p>
      {children}
    </div>
  );
}

export { CanonicalIdentifiers };

import type { ReactNode } from "react";
import Link from "next/link";
import { sceneStillUrl } from "@/lib/assemble/composition";
import { formatTimelineMs } from "@/lib/media/timing";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import type { UniverseAssemblyMural } from "@/lib/assemble";
import { CreativeStill } from "./creative-still";

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

export function MuralPresence({
  mural,
  openHref,
  openLabel,
}: {
  mural: UniverseAssemblyMural;
  openHref: string;
  openLabel: string;
}) {
  const timedScenes = mural.scenes.filter((scene) => scene.start_ms != null && scene.end_ms != null);
  const startMs = timedScenes.length ? Math.min(...timedScenes.map((scene) => scene.start_ms as number)) : null;
  const endMs = timedScenes.length ? Math.max(...timedScenes.map((scene) => scene.end_ms as number)) : null;
  const presenceTime = mural.scenes.find((scene) => scene.start_ms != null)?.start_ms ?? 5000;
  const still = sceneStillUrl({
    provider: mural.provider,
    storage_ref: mural.storage_ref,
    start_ms: presenceTime,
  });
  const stillUrl = still
    ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 1280 })
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
          <p>Canonical media is bound to this Mural. Playback lives on the public Experience, not in the Suite.</p>
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

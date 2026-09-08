import Link from "next/link";
import { sceneOrdinal, sceneShortTitle, sceneStillUrl } from "@/lib/assemble/composition";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
import type { SuiteScene } from "@/lib/assemble/suite";
import { CreativeStill } from "./creative-still";

export function SceneObject({
  scene,
  index,
  sharedMoment,
  openHref,
  openLabel,
}: {
  scene: SuiteScene;
  index: number;
  sharedMoment: boolean;
  openHref: string;
  openLabel: string;
}) {
  const ordinal = scene.sort_order != null ? String(scene.sort_order).padStart(2, "0") : sceneOrdinal(index);
  const shortTitle = sceneShortTitle(scene.title) ?? "Untitled scene";
  const fullTitle = scene.title?.trim() || null;
  const showFullTitle = fullTitle && fullTitle !== shortTitle;
  const still = sceneStillUrl(scene);
  const stillUrl = still
    ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 640 })
    : null;
  const timing =
    scene.start_ms != null && scene.end_ms != null
      ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
      : null;
  const headingId = `universe-scene-heading-${scene.master_id}`;

  return (
    <article
      id={`universe-scene-${scene.master_id}`}
      className="suite-scene-object"
      data-scene-id={scene.master_id}
      data-related-moments={scene.creative_moment_id ?? undefined}
      aria-labelledby={headingId}
    >
      <div className="suite-scene-still">
        <CreativeStill url={stillUrl} alt="" />
        <p className="suite-scene-ordinal" aria-hidden="true">
          {ordinal}
        </p>
      </div>
      <div className="suite-scene-body">
        <h3 id={headingId} className="suite-scene-title">
          <span className="sr-only">Scene {ordinal}. </span>
          {shortTitle}
        </h3>
        {showFullTitle ? <p className="suite-scene-full-title">{fullTitle}</p> : null}
        <p className="suite-scene-timing">
          {timing ?? <span className="italic text-muted-foreground/70">Timing not set</span>}
        </p>
        {scene.creative_moment_id && scene.creative_moment_title ? (
          <p className="suite-scene-moment">
            <span className="suite-relation-kicker">
              Related Creative Moment{sharedMoment ? " · shared" : ""}
            </span>
            <Link
              href={`#universe-moment-${scene.creative_moment_id}`}
              className="suite-relation-link"
            >
              {scene.creative_moment_title}
            </Link>
          </p>
        ) : (
          <p className="suite-scene-moment italic text-muted-foreground/70">No Creative Moment related</p>
        )}
        <p className="suite-object-actions">
          <Link href={openHref} className="suite-open-link">
            {openLabel}
            <span className="sr-only"> for scene {shortTitle}</span>
          </Link>
        </p>
      </div>
    </article>
  );
}

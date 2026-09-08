import Link from "next/link";
import { sceneOrdinal, sceneShortTitle, sceneStillUrl, sceneCreativeMomentIds } from "@/lib/assemble/composition";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
import type { PresenceOption } from "@/lib/assemble/presence";
import type { SuiteScene } from "@/lib/assemble/suite";
import { CreativeStill } from "./creative-still";
import { ScenePresence } from "./presence-authoring";

export function SceneObject({
  scene,
  index,
  sharedIds,
  candidates,
  universeId,
  canAuthorPresence,
  openHref,
  openLabel,
}: {
  scene: SuiteScene;
  index: number;
  sharedIds: string[];
  candidates: PresenceOption[];
  universeId: string;
  canAuthorPresence: boolean;
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
  const related = (scene.creative_moments?.length
    ? scene.creative_moments
    : scene.creative_moment_id
      ? [{ master_id: scene.creative_moment_id, title: scene.creative_moment_title }]
      : []) satisfies PresenceOption[];

  return (
    <article
      id={`universe-scene-${scene.master_id}`}
      className="suite-scene-object"
      data-scene-id={scene.master_id}
      data-related-moments={sceneCreativeMomentIds(scene).join(" ") || undefined}
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
        <ScenePresence
          universeId={universeId}
          sceneId={scene.master_id}
          sceneLabel={shortTitle}
          related={related}
          candidates={candidates}
          sharedIds={sharedIds}
          canAuthor={canAuthorPresence}
        />
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

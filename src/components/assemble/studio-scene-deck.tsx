import Link from "next/link";
import { sceneCreativeMomentIds, sceneOrdinal, sceneShortTitle, sceneStillUrl } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import { creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreativeStill } from "./creative-still";

export function StudioSceneDeck({
  universeId,
  scenes,
  from = null,
  identified = false,
}: {
  universeId: string;
  scenes: SuiteScene[];
  from?: "curate" | null;
  identified?: boolean;
}) {
  return (
    <ol className="studio-scene-deck">
      {scenes.map((scene, index) => {
        const ordinal = scene.sort_order != null ? String(scene.sort_order).padStart(2, "0") : sceneOrdinal(index);
        const still = sceneStillUrl(scene);
        const url = still
          ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 320 })
          : null;
        const timing =
          scene.start_ms != null && scene.end_ms != null
            ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
            : null;
        const shortTitle = sceneShortTitle(scene.title) ?? "Untitled";
        const momentCount = sceneCreativeMomentIds(scene).length;
        return (
          <li key={scene.master_id}>
            <article
              className="studio-scene-card"
              data-scene-id={scene.master_id}
              data-related-moments={sceneCreativeMomentIds(scene).join(" ") || undefined}
            >
              <div className="suite-scene-row">
                <div className="suite-scene-thumb">
                  <CreativeStill url={url} alt="" />
                  <p className="suite-scene-ordinal" aria-hidden="true">
                    {ordinal}
                  </p>
                </div>
                <div className="suite-scene-copy">
                  <p className="suite-scene-title">
                    <span className="sr-only">Scene {ordinal}. </span>
                    {shortTitle}
                  </p>
                  {timing ? <p className="suite-scene-timing">{timing}</p> : null}
                  <p className="suite-meta-status">
                    {momentCount > 0 ? `Creative Moment · ${momentCount}` : "No Creative Moment"}
                  </p>
                </div>
                <div className="suite-scene-row-actions">
                  <Link
                    id={identified ? `universe-scene-${scene.master_id}` : undefined}
                    href={creativeSuiteWorkspaceHref(universeId, "scenes", from, scene.master_id)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Open
                    <span className="sr-only"> Scene {shortTitle}</span>
                  </Link>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

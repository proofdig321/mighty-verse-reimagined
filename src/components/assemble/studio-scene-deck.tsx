import Link from "next/link";
import { sceneCreativeMomentIds, sceneOrdinal, sceneShortTitle, sceneStillUrl } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import { creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { formatTimelineMs } from "@/lib/media/timing";
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
          ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 640 })
          : null;
        const timing =
          scene.start_ms != null && scene.end_ms != null
            ? `${formatTimelineMs(scene.start_ms)} → ${formatTimelineMs(scene.end_ms)}`
            : null;
        return (
          <li key={scene.master_id}>
            <Link
              id={identified ? `universe-scene-${scene.master_id}` : undefined}
              href={creativeSuiteWorkspaceHref(universeId, "scenes", from, scene.master_id)}
              className="studio-scene-card"
              data-scene-id={scene.master_id}
              data-related-moments={sceneCreativeMomentIds(scene).join(" ") || undefined}
            >
              <div className="studio-scene-card-still">
                <CreativeStill url={url} alt="" />
                <p className="suite-scene-ordinal" aria-hidden="true">
                  {ordinal}
                </p>
              </div>
              <p className="suite-kicker">
                {ordinal} {sceneShortTitle(scene.title) ?? "Untitled"}
              </p>
              {timing ? <p className="font-mono text-[10px] text-muted-foreground">{timing}</p> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

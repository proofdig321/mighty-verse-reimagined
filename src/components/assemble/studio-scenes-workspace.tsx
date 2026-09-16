import { sceneCreativeMomentIds, sceneShortTitle, sharedCreativeMomentIds } from "@/lib/assemble/composition";
import { availablePresenceOptions } from "@/lib/assemble/presence";
import { suiteScenes } from "@/lib/assemble/suite";
import { creativeSuiteScenesHref } from "@/lib/assemble/studio";
import type { UniverseAssembly } from "@/lib/assemble";
import { CompositionSurface } from "./composition-surface";
import { CreativeMomentObject } from "./creative-moment-object";
import { SceneObject } from "./scene-object";
import { StudioEmptyState } from "./studio-empty-state";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StudioScenesWorkspace({
  data,
  canAuthorPresence = false,
  canAuthorIdentity = false,
  canAuthorTiming = false,
  canAuthorOrder = false,
  focusSceneId,
  fromCurate = false,
}: {
  data: UniverseAssembly;
  canAuthorPresence?: boolean;
  canAuthorIdentity?: boolean;
  canAuthorTiming?: boolean;
  canAuthorOrder?: boolean;
  focusSceneId?: string;
  fromCurate?: boolean;
}) {
  const scenes = suiteScenes(data);
  const sharedIds = [...sharedCreativeMomentIds(scenes)];
  const momentOptions = data.creative_moments.map((moment) => ({
    master_id: moment.master_id,
    title: moment.title,
  }));
  const sceneOptions = scenes.map((scene) => ({
    master_id: scene.master_id,
    title: sceneShortTitle(scene.title) ?? scene.title,
  }));
  const visibleScenes = focusSceneId ? scenes.filter((scene) => scene.master_id === focusSceneId) : scenes;
  const relatedMomentIds = new Set(
    visibleScenes.flatMap((scene) => sceneCreativeMomentIds(scene)),
  );
  const visibleMoments = focusSceneId
    ? data.creative_moments.filter((moment) => relatedMomentIds.has(moment.master_id))
    : data.creative_moments;
  const from = fromCurate ? "curate" : null;
  const compact = !focusSceneId;

  return (
    <CompositionSurface>
      <div className="suite-stack">
        <section className="suite-section" aria-labelledby="universe-scenes">
          <div className="suite-section-head studio-section-head">
            <h2 id="universe-scenes" className="suite-section-title">
              {focusSceneId ? "Scene" : "Scenes"}
            </h2>
            {compact ? (
              <Badge variant="secondary">
                {scenes.length} Scene{scenes.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          {visibleScenes.length === 0 ? (
            <StudioEmptyState
              kicker="Scenes"
              title="No Scenes assembled yet."
              body="Scenes are the visual units of this Universe. They are authored from source media, not generated as canonical truth."
            />
          ) : (
            <ol className={compact ? "studio-scene-deck" : "suite-scene-grid"} data-scene-list={focusSceneId ? "focus" : "all"}>
              {visibleScenes.map((scene) => {
                const index = scenes.findIndex((row) => row.master_id === scene.master_id);
                return (
                  <li key={scene.master_id}>
                    <SceneObject
                      scene={scene}
                      index={index}
                      sharedIds={sharedIds}
                      candidates={availablePresenceOptions(momentOptions, sceneCreativeMomentIds(scene))}
                      muralSceneIds={scenes.filter((row) => row.mural_id === scene.mural_id).map((row) => row.master_id)}
                      universeId={data.master_id}
                      canAuthorPresence={canAuthorPresence}
                      canAuthorIdentity={canAuthorIdentity}
                      canAuthorTiming={canAuthorTiming}
                      canAuthorOrder={canAuthorOrder}
                      openHref={`/authority/${scene.master_id}`}
                      openLabel="Open record"
                      workspaceHref={focusSceneId ? null : creativeSuiteScenesHref(data.master_id, from, scene.master_id)}
                      compact={compact}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="suite-section" aria-labelledby="universe-moments">
          <div className="suite-section-head studio-section-head">
            <h2 id="universe-moments" className="suite-section-title">
              Creative Moments
            </h2>
            <Badge variant="secondary">
              {visibleMoments.length} Creative Moment{visibleMoments.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {visibleMoments.length === 0 ? (
            <StudioEmptyState
              kicker="Creative Moments"
              title="No Creative Moments assembled yet."
              body="Creative Moments connect selected Scene material to a deliberate creative realization."
              action={
                compact ? (
                  <Link href={creativeSuiteScenesHref(data.master_id, from)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Explore Scenes
                  </Link>
                ) : null
              }
            />
          ) : (
            <ul className={compact ? "studio-moment-list" : "suite-moment-grid"}>
              {visibleMoments.map((moment) => (
                <li key={moment.master_id}>
                  <CreativeMomentObject
                    moment={moment}
                    candidates={availablePresenceOptions(sceneOptions, moment.scene_ids)}
                    universeId={data.master_id}
                    canAuthorPresence={canAuthorPresence}
                    canAuthorIdentity={canAuthorIdentity}
                    openHref={`/authority/${moment.master_id}`}
                    openLabel="Open record"
                    compact={compact}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CompositionSurface>
  );
}

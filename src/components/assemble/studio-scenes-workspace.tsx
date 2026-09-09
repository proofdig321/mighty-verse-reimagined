import { sceneCreativeMomentIds, sceneShortTitle, sharedCreativeMomentIds } from "@/lib/assemble/composition";
import { availablePresenceOptions } from "@/lib/assemble/presence";
import { suiteScenes } from "@/lib/assemble/suite";
import type { UniverseAssembly } from "@/lib/assemble";
import { CompositionSurface } from "./composition-surface";
import { CreativeMomentObject } from "./creative-moment-object";
import { SceneObject } from "./scene-object";
import { StudioSceneDeck } from "./studio-scene-deck";

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

  return (
    <CompositionSurface>
      <div className="suite-stack">
        <section className="suite-section" aria-labelledby="universe-scenes">
          <div className="suite-section-head">
            <h2 id="universe-scenes" className="suite-section-title">
              {focusSceneId ? "Scene" : "Scene deck"}
            </h2>
          </div>
          {visibleScenes.length === 0 ? (
            <p className="suite-empty">No scenes assembled for this Universe yet.</p>
          ) : focusSceneId ? (
            <ol className="suite-scene-grid">
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
                    />
                  </li>
                );
              })}
            </ol>
          ) : (
            <StudioSceneDeck universeId={data.master_id} scenes={scenes} from={from} identified />
          )}
        </section>

        <section className="suite-section" aria-labelledby="universe-moments">
          <div className="suite-section-head">
            <h2 id="universe-moments" className="suite-section-title">
              Creative Moments
            </h2>
          </div>
          {visibleMoments.length === 0 ? (
            <p className="suite-empty">No Creative Moments assembled in this Universe yet.</p>
          ) : (
            <ul className="suite-moment-grid">
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

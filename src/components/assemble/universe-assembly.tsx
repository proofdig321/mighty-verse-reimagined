import type { ReactNode } from "react";
import { sceneCreativeMomentIds, sceneShortTitle, sharedCreativeMomentIds } from "@/lib/assemble/composition";
import { availablePresenceOptions } from "@/lib/assemble/presence";
import { suiteScenes } from "@/lib/assemble/suite";
import type { UniverseAssembly } from "@/lib/assemble";
import { CompositionSurface } from "./composition-surface";
import { CreativeMomentObject } from "./creative-moment-object";
import { ExperienceContinuation } from "./experience-continuation";
import { CanonicalIdentifiers, MuralEmpty, MuralPresence } from "./mural-presence";
import { SceneObject } from "./scene-object";

export type UniverseAssemblyProps = {
  data: UniverseAssembly;
  openHref: (masterId: string) => string;
  openLabel?: string;
  muralEmptyAction?: ReactNode;
  experienceHref?: string;
  canAuthorPresence?: boolean;
};

function untitled(kind: string) {
  return <span className="italic text-muted-foreground">Untitled {kind}</span>;
}

export default function UniverseAssemblyView({
  data,
  openHref,
  openLabel = "Open",
  muralEmptyAction,
  experienceHref,
  canAuthorPresence = false,
}: UniverseAssemblyProps) {
  const scenes = suiteScenes(data);
  const sharedMoments = sharedCreativeMomentIds(scenes);
  const sharedIds = [...sharedMoments];
  const momentOptions = data.creative_moments.map((moment) => ({
    master_id: moment.master_id,
    title: moment.title,
  }));
  const sceneOptions = scenes.map((scene) => ({
    master_id: scene.master_id,
    title: sceneShortTitle(scene.title) ?? scene.title,
  }));

  return (
    <CompositionSurface>
      <div className="suite-stack">
        <section className="suite-section" aria-labelledby="universe-identity">
          <div className="suite-identity">
            <p className="suite-kicker">World</p>
            <h2 id="universe-identity" className="suite-section-title">
              Identity
            </h2>
            <p className="suite-identity-title">{data.title ?? untitled("universe")}</p>
            <p className="suite-identity-description">
              {data.description ?? <span className="italic text-muted-foreground">No description yet.</span>}
            </p>
            <CanonicalIdentifiers
              items={[
                { label: "Master", value: data.master_id },
                { label: "Created", value: data.created_at.slice(0, 10) },
              ]}
            />
          </div>
        </section>

        {experienceHref ? (
          <ExperienceContinuation href={experienceHref} universeTitle={data.title ?? "this Universe"} />
        ) : null}

        <section className="suite-section" aria-labelledby="universe-mural">
          <div className="suite-section-head">
            <h2 id="universe-mural" className="suite-section-title">
              Mural
            </h2>
            <p className="suite-section-note">
              The stage for this Universe. Registering a Mural establishes the container. Mural editing is a later increment.
            </p>
          </div>
          {data.murals.length === 0 ? (
            <MuralEmpty>{muralEmptyAction}</MuralEmpty>
          ) : (
            <div className="space-y-6">
              {data.murals.map((mural) => (
                <MuralPresence
                  key={mural.master_id}
                  mural={mural}
                  openHref={openHref(mural.master_id)}
                  openLabel={openLabel}
                />
              ))}
            </div>
          )}
        </section>

        <section className="suite-section" aria-labelledby="universe-scenes">
          <div className="suite-section-head">
            <h2 id="universe-scenes" className="suite-section-title">
              Scenes
            </h2>
            <p className="suite-section-note">
              Face-up canonical visual units on the Mural. Shared Creative Moments stay shared. Presence can be authored here. Scene identity, timing, and order remain later increments.
            </p>
          </div>
          {scenes.length === 0 ? (
            <p className="suite-empty">No scenes assembled for this Universe yet.</p>
          ) : (
            <ol className="suite-scene-grid">
              {scenes.map((scene, index) => (
                <li key={scene.master_id}>
                  <SceneObject
                    scene={scene}
                    index={index}
                    sharedIds={sharedIds}
                    candidates={availablePresenceOptions(momentOptions, sceneCreativeMomentIds(scene))}
                    universeId={data.master_id}
                    canAuthorPresence={canAuthorPresence}
                    openHref={openHref(scene.master_id)}
                    openLabel={openLabel}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="suite-section" aria-labelledby="universe-moments">
          <div className="suite-section-head">
            <h2 id="universe-moments" className="suite-section-title">
              Creative Moments
            </h2>
            <p className="suite-section-note">
              Contributor-centred units of this Universe, not owned by the Mural. A Creative Moment may relate to more than one Scene.
            </p>
          </div>
          {data.creative_moments.length === 0 ? (
            <p className="suite-empty">No Creative Moments assembled in this Universe yet.</p>
          ) : (
            <ul className="suite-moment-grid">
              {data.creative_moments.map((moment) => (
                <li key={moment.master_id}>
                  <CreativeMomentObject
                    moment={moment}
                    candidates={availablePresenceOptions(sceneOptions, moment.scene_ids)}
                    universeId={data.master_id}
                    canAuthorPresence={canAuthorPresence}
                    openHref={openHref(moment.master_id)}
                    openLabel={openLabel}
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

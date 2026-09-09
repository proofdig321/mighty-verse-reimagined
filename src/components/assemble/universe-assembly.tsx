import type { ReactNode } from "react";
import { sceneCreativeMomentIds, sceneShortTitle, sharedCreativeMomentIds } from "@/lib/assemble/composition";
import { availablePresenceOptions } from "@/lib/assemble/presence";
import { suiteScenes } from "@/lib/assemble/suite";
import type { UniverseAssembly } from "@/lib/assemble";
import type { ProductionPathStep } from "@/lib/assemble/workflow";
import type { SuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import { CompositionSurface } from "./composition-surface";
import { CreativeMomentObject } from "./creative-moment-object";
import { ExperienceContinuation } from "./experience-continuation";
import { CanonicalIdentifiers, MuralEmpty, MuralPresence } from "./mural-presence";
import { ProductionPath } from "./production-path";
import { SceneObject } from "./scene-object";
import { SentinelIntelligencePanel } from "./sentinel-intelligence";
import { SourcePreview } from "./source-preview";
import { StudioPreview } from "./studio-preview";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";

export type UniverseAssemblyProps = {
  data: UniverseAssembly;
  openHref: (masterId: string) => string;
  openLabel?: string;
  muralEmptyAction?: ReactNode;
  experienceHref?: string;
  canAuthorPresence?: boolean;
  canAuthorIdentity?: boolean;
  canAuthorTiming?: boolean;
  canAuthorOrder?: boolean;
  canAuthoriseSentinel?: boolean;
  intelligence?: SentinelIntelligence | null;
  inspectHref?: string | null;
  holographicHref?: string | null;
  source?: SuiteSourcePreview | null;
  productionPath?: ProductionPathStep[];
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
  canAuthorIdentity = false,
  canAuthorTiming = false,
  canAuthorOrder = false,
  canAuthoriseSentinel = false,
  intelligence = null,
  inspectHref = null,
  holographicHref = null,
  source = null,
  productionPath = [],
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

        {productionPath.length > 0 ? <ProductionPath steps={productionPath} /> : null}

        <section className="suite-section" aria-labelledby="universe-source">
          <div className="suite-section-head">
            <h2 id="universe-source" className="suite-section-title">
              Source
            </h2>
            <p className="suite-section-note">
              The bound audiovisual media for this Universe. Preview is observational. It does not rewrite Scene windows.
            </p>
          </div>
          {source ? (
            <SourcePreview source={source} inspectHref={inspectHref} />
          ) : (
            <p className="suite-empty">No source media is bound to this Universe yet.</p>
          )}
        </section>

        <section className="suite-section" aria-labelledby="universe-mural">
          <div className="suite-section-head">
            <h2 id="universe-mural" className="suite-section-title">
              Mural
            </h2>
            <p className="suite-section-note">
              The stage for this Universe. Registering a Mural establishes the container. Source playback lives in Studio preview above. Public mural playback remains Experience.
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

        {intelligence ? (
          <section className="suite-section" aria-labelledby="universe-sentinel">
            <div className="suite-section-head">
              <h2 id="universe-sentinel" className="suite-section-title">
                Sentinel
              </h2>
              <p className="suite-section-note">
                Observational evidence becomes storyboard, animation plan, and Scene-boundary proposals.
                The curator still authorises canonical meaning. Sentinel does not create Scenes.
              </p>
            </div>
            <SentinelIntelligencePanel
              universeId={data.master_id}
              intelligence={intelligence}
              canAuthorise={canAuthoriseSentinel}
              inspectHref={inspectHref}
              previewHref="#universe-preview"
            />
          </section>
        ) : null}

        {intelligence && experienceHref && holographicHref ? (
          <section className="suite-section" aria-labelledby="universe-preview">
            <div className="suite-section-head">
              <h2 id="universe-preview" className="suite-section-title">
                2.5D Preview
              </h2>
              <p className="suite-section-note">
                Studio Preview of the canonical composition. Switch 2D and 2.5D without leaving authoring.
              </p>
            </div>
            <StudioPreview
              universeTitle={data.title ?? "this Universe"}
              scenes={scenes}
              layers={intelligence.holographic}
              experienceHref={experienceHref}
              holographicHref={holographicHref}
            />
          </section>
        ) : null}

        <section className="suite-section" aria-labelledby="universe-scenes">
          <div className="suite-section-head">
            <h2 id="universe-scenes" className="suite-section-title">
              Scenes
            </h2>
            <p className="suite-section-note">
              Face-up canonical visual units on the Mural. Shared Creative Moments stay shared. Identity, timing, canonical order, and presence can be authored here. Sentinel proposes windows; it does not create Scenes.
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
                    muralSceneIds={scenes.filter((row) => row.mural_id === scene.mural_id).map((row) => row.master_id)}
                    universeId={data.master_id}
                    canAuthorPresence={canAuthorPresence}
                    canAuthorIdentity={canAuthorIdentity}
                    canAuthorTiming={canAuthorTiming}
                    canAuthorOrder={canAuthorOrder}
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
              Contributor-centred units of this Universe, not owned by the Mural. A Creative Moment may relate to more than one Scene. Identity and presence can be authored here.
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
                    canAuthorIdentity={canAuthorIdentity}
                    openHref={openHref(moment.master_id)}
                    openLabel={openLabel}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {experienceHref ? (
          <ExperienceContinuation
            href={experienceHref}
            holographicHref={holographicHref}
            universeTitle={data.title ?? "this Universe"}
          />
        ) : null}
      </div>
    </CompositionSurface>
  );
}

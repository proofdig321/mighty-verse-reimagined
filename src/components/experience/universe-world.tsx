import Link from "next/link";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import { buttonVariants } from "@/components/ui/button";
import {
  contributorPresence,
  sceneOrdinal,
  sceneShortTitle,
  sceneStillUrl,
  type UniverseMuralStage,
  type UniverseMomentPresence,
  type UniverseSceneEncounter,
  type UniverseSceneMomentRel,
} from "@/lib/experience/universe-world";
import { cn } from "@/lib/utils";
import { CreativeMomentCard } from "./creative-moment-card";

export type UniverseWorldExperienceProps = {
  universeId: string;
  title: string;
  description: string | null;
  attributionRoles: string[];
  murals: UniverseMuralStage[];
  scenes: UniverseSceneEncounter[];
  moments: UniverseMomentPresence[];
  sceneMoments: UniverseSceneMomentRel[];
  muralStill: { provider: string; storage_ref: string; timeSec: number } | null;
  productionSceneIds?: string[];
};

function EncounterStill({
  url,
  alt,
}: {
  url: string | null;
  alt: string;
}) {
  if (!url) {
    return <div className="world-still-placeholder" aria-hidden="true" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="world-still" />
  );
}

export function UniverseWorldExperience({
  universeId,
  title,
  description,
  attributionRoles,
  murals,
  scenes,
  moments,
  sceneMoments,
  muralStill,
  productionSceneIds = [],
}: UniverseWorldExperienceProps) {
  const mural = murals[0] ?? null;
  const muralStillUrl = muralStill
    ? providerThumbnailUrl(muralStill.provider, muralStill.storage_ref, {
        timeSec: muralStill.timeSec,
        width: 1280,
      })
    : null;
  const contributors = contributorPresence(moments, scenes, sceneMoments);
  const sceneDeckHref = `/worlds/${universeId}/scenes`;
  const muralHref = mural ? `/worlds/${mural.master_id}` : null;
  const experienceHref = `/worlds/${universeId}/holographic`;
  const productionSet = new Set(productionSceneIds);

  return (
    <div className="world-experience">
      <section className="world-identity" aria-labelledby="world-identity-heading">
        <p className="world-kicker">Universe</p>
        <h1 id="world-identity-heading" className="world-title">
          {title}
        </h1>
        {description ? <p className="world-statement">{description}</p> : null}
        {attributionRoles.length > 0 ? (
          <p className="world-attribution">
            {attributionRoles.map((role) => role.replace(/-/g, " ")).join(" · ")}
          </p>
        ) : null}
        <div className="world-actions">
          <Link
            href={experienceHref}
            className={cn(buttonVariants({ size: "lg" }), "world-action-primary")}
            data-experience-entry="experience"
          >
            Enter Experience
            <span className="sr-only">{` for ${title}`}</span>
          </Link>
          <Link href={sceneDeckHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Enter Scene Deck
          </Link>
          {muralHref ? (
            <Link href={muralHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              View Mural
            </Link>
          ) : null}
        </div>
      </section>

      {mural ? (
        <section className="world-section" aria-labelledby="world-mural-heading">
          <p className="world-kicker">Reveal</p>
          <h2 id="world-mural-heading" className="world-section-title">
            The Mural
          </h2>
          <p className="world-section-note">
            The complete audiovisual expression of this Universe. Playback lives on the Mural.
          </p>
          <Link href={`/worlds/${mural.master_id}`} className="world-mural-stage">
            <EncounterStill url={muralStillUrl} alt="" />
            <div className="world-mural-copy">
              <p className="world-kicker">Mural</p>
              <p className="world-mural-title">{mural.title ?? "Mural"}</p>
              <p className="world-section-note">Play Mural</p>
            </div>
          </Link>
        </section>
      ) : null}

      {scenes.length > 0 ? (
        <section className="world-section" aria-labelledby="world-encounters-heading">
          <div className="world-section-head">
            <div>
              <p className="world-kicker">Reveal</p>
              <h2 id="world-encounters-heading" className="world-section-title">
                Scenes
              </h2>
              <p className="world-section-note">
                Canonical spatial units in the Mural. Inspect a Scene, or continue to the Scene Deck.
              </p>
            </div>
            <Link href={sceneDeckHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Continue to Scene Deck
            </Link>
          </div>
          <ol className="world-encounter-grid">
            {scenes.map((scene, index) => {
              const shortTitle = sceneShortTitle(scene.title) ?? `Scene ${index + 1}`;
              const still = sceneStillUrl({
                provider: scene.provider,
                storage_ref: scene.playback_id,
                start_ms: scene.start_ms,
              });
              const stillUrl = still
                ? providerThumbnailUrl(still.provider, still.storage_ref, {
                    timeSec: still.timeSec,
                    width: 720,
                  })
                : null;
              const sceneHref = scene.projection_id ? `/moments/${scene.projection_id}` : sceneDeckHref;
              const hasProduction = productionSet.has(scene.master_id);
              return (
                <li key={scene.master_id}>
                  <Link href={sceneHref} className="world-encounter-link">
                    <article
                      className="world-encounter"
                      data-scene-id={scene.master_id}
                      data-has-production={hasProduction ? "true" : "false"}
                      aria-labelledby={`world-scene-${scene.master_id}`}
                    >
                      <EncounterStill url={stillUrl} alt="" />
                      <p className="world-encounter-ordinal">{sceneOrdinal(index)}</p>
                      <h3 id={`world-scene-${scene.master_id}`} className="world-encounter-title">
                        {shortTitle}
                      </h3>
                      {scene.title && scene.title !== shortTitle ? (
                        <p className="world-encounter-full">{scene.title}</p>
                      ) : null}
                      {hasProduction ? (
                        <p className="world-encounter-full">Approved production layer</p>
                      ) : null}
                    </article>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {contributors.length > 0 ? (
        <section className="world-section" aria-labelledby="world-presence-heading">
          <p className="world-kicker">Reveal</p>
          <h2 id="world-presence-heading" className="world-section-title">
            Creative Moments
          </h2>
          <p className="world-section-note">
            Contributors present in this Universe. A Creative Moment is not a Moment Card.
          </p>
          <ul className="world-presence-list">
            {contributors.map((contributor) => (
              <li key={contributor.master_id}>
                <CreativeMomentCard
                  masterId={contributor.master_id}
                  title={contributor.title ?? "Creative Moment"}
                  stillUrl={contributor.stillUrl}
                  href={contributor.href}
                  sceneTitles={contributor.scenes.map((scene) => scene.shortTitle)}
                  kind={
                    contributor.hasMomentProjection
                      ? "Creative Moment with a Moment encounter"
                      : "Creative identity in this Universe"
                  }
                  copyMode="always"
                  hasMomentProjection={contributor.hasMomentProjection}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

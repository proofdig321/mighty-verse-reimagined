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
          <Link href={sceneDeckHref} className={cn(buttonVariants({ size: "lg" }), "world-action-primary")}>
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
          <p className="world-kicker">Stage</p>
          <h2 id="world-mural-heading" className="world-section-title">
            The Mural
          </h2>
          <p className="world-section-note">
            The audiovisual expression of this Universe. Playback lives on the Mural experience.
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
              <p className="world-kicker">Encounters</p>
              <h2 id="world-encounters-heading" className="world-section-title">
                Scenes
              </h2>
              <p className="world-section-note">
                Cinematic encounters in this Universe. The Scene Deck remains the place to reveal them.
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
              return (
                <li key={scene.master_id}>
                  <article className="world-encounter" aria-labelledby={`world-scene-${scene.master_id}`}>
                    <EncounterStill url={stillUrl} alt="" />
                    <p className="world-encounter-ordinal">{sceneOrdinal(index)}</p>
                    <h3 id={`world-scene-${scene.master_id}`} className="world-encounter-title">
                      {shortTitle}
                    </h3>
                    {scene.title && scene.title !== shortTitle ? (
                      <p className="world-encounter-full">{scene.title}</p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {contributors.length > 0 ? (
        <section className="world-section" aria-labelledby="world-presence-heading">
          <p className="world-kicker">Presence</p>
          <h2 id="world-presence-heading" className="world-section-title">
            Creative Moments
          </h2>
          <p className="world-section-note">
            Contributors present in this Universe. A Creative Moment is not a Moment Card.
          </p>
          <ul className="world-presence-list">
            {contributors.map((contributor) => (
              <li key={contributor.master_id}>
                <article
                  className="world-presence"
                  data-moment-id={contributor.master_id}
                  data-has-moment-projection={contributor.hasMomentProjection ? "true" : "false"}
                  aria-labelledby={`world-moment-${contributor.master_id}`}
                >
                  <h3 id={`world-moment-${contributor.master_id}`} className="world-presence-title">
                    {contributor.title ?? "Creative Moment"}
                  </h3>
                  <p className="world-presence-kind">
                    {contributor.hasMomentProjection
                      ? "Creative Moment with a Moment encounter"
                      : "Creative identity in this Universe"}
                  </p>
                  {contributor.scenes.length > 0 ? (
                    <p className="world-presence-scenes">
                      {contributor.scenes.length > 1 ? "Present across " : "Present in "}
                      {contributor.scenes.map((scene) => scene.shortTitle).join(" and ")}
                    </p>
                  ) : null}
                  <Link href={contributor.href} className="world-presence-link">
                    {contributor.hasMomentProjection ? "Encounter" : "View identity"}
                    <span className="sr-only">
                      {` ${contributor.title ?? "Creative Moment"}`}
                    </span>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

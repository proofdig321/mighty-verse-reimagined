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
import { ENTER_2_5D_LABEL, HOLOGRAPHIC_EXPERIENCE_LABEL, public2_5dHref, publicHolographicHref } from "@/lib/experience/destinations";

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
  song?: {
    work_type: string;
    genre: string | null;
    subgenre: string | null;
    language: string | null;
    release_date: string | null;
    creator_name: string | null;
    artwork_url: string | null;
  } | null;
  distributional?: { projection_id: string; title: string | null; url: string | null }[];
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
  song,
  distributional = [],
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
  const holographicHref = publicHolographicHref(universeId);
  const spatialHref = public2_5dHref(universeId);
  const productionSet = new Set(productionSceneIds);

  return (
    <div className="world-experience" data-experience-entry="universe" aria-label={`Universe · ${title}`}>
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

        {/* Song identity — only when work_type=song or artwork exists */}
        {song ? (
          <div className="world-song-identity" data-song-identity="">
            {song.artwork_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={song.artwork_url}
                alt={`${title} artwork`}
                className="world-song-artwork"
              />
            ) : null}
            <div className="world-song-meta">
              {song.creator_name ? (
                <p className="world-song-creator">{song.creator_name}</p>
              ) : null}
              {(song.genre || song.subgenre) ? (
                <p className="world-song-genre">
                  {[song.genre, song.subgenre].filter(Boolean).join(" / ")}
                </p>
              ) : null}
              {song.release_date ? (
                <p className="world-song-release">{song.release_date}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Distributional projections — only when actual records exist */}
        {distributional.length > 0 ? (
          <div className="world-distribution" data-distribution="">
            <p className="world-kicker">Also available on</p>
            <ul className="world-distribution-links">
              {distributional.map((d) =>
                d.url ? (
                  <li key={d.projection_id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="world-distribution-link"
                    >
                      {d.title ?? d.url}
                    </a>
                  </li>
                ) : null
              )}
            </ul>
          </div>
        ) : null}

        <div className="world-actions">
          <Link
            href={spatialHref}
            className={cn(buttonVariants({ size: "lg" }), "world-action-primary")}
            data-experience-entry="2.5d"
          >
            {ENTER_2_5D_LABEL}
            <span className="sr-only">{` for ${title}`}</span>
          </Link>
          <Link
            href={holographicHref}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            data-experience-entry="holographic"
          >
            {HOLOGRAPHIC_EXPERIENCE_LABEL}
            <span className="sr-only">{` for ${title}`}</span>
          </Link>
          {scenes.length > 0 ? (
            <Link
              href={sceneDeckHref}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              data-scene-deck-cta="live"
            >
              Enter Scene Deck
            </Link>
          ) : null}
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
            {scenes.length > 0
              ? "The complete audiovisual expression of this Universe. Playback lives on the Mural in 2.5D and in Holographic Experience."
              : "The complete audiovisual expression of this Universe. Play it here, on the Mural in 2.5D, or in Holographic Experience. Canonical Scenes are established by a curator — they are not inferred from the file."}
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
      ) : mural ? (
        <section className="world-section" aria-labelledby="world-encounters-heading" data-universe-scenes="empty">
          <p className="world-kicker">Reveal</p>
          <h2 id="world-encounters-heading" className="world-section-title">
            Scenes
          </h2>
          <p className="world-section-note">
            No canonical Scenes are authorised yet. The Mural still plays in full. Intro, Verse, Hook, and other
            windows are curator decisions — they are not inferred from the file.
          </p>
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

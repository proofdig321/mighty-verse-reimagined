import type { ReactNode } from "react";
import { PublicHeroParallax } from "@/components/public-hero-parallax";
import { PublicHeroVideo } from "@/components/public-hero-video";

export type PublicHeroStat = {
  n: ReactNode;
  label: string;
};

export type PublicHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  kicker?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  stats?: PublicHeroStat[];
  size?: "display" | "page";
  /** Mux playback ID for the background video (display size only) */
  videoPlaybackId?: string | null;
  /** Still image URL shown while video loads or as fallback */
  stillUrl?: string | null;
  /** Universe title used for trailer modal aria-label */
  universeTitle?: string;
  /** Text colour scheme over the hero background */
  textScheme?: "light" | "dark";
};

/**
 * Shared audience page hero. Home uses `display`; catalogue and walkthrough
 * pages use `page`. Playback heroes stay on MediaHero — this is identity copy,
 * not Mux cinema.
 */
export function PublicHero({
  eyebrow,
  title,
  description,
  kicker,
  actions,
  aside,
  stats,
  size = "page",
  videoPlaybackId,
  stillUrl,
  universeTitle = "Mighty Verse",
  textScheme = "light",
}: PublicHeroProps) {
  const display = size === "display";
  const hasVideo = display && Boolean(videoPlaybackId);

  // When a video is present, override text colours based on scheme
  const fg = hasVideo ? (textScheme === "dark" ? "#0a0a0a" : "#ffffff") : undefined;
  const fgMuted = hasVideo ? (textScheme === "dark" ? "rgba(10,10,10,0.65)" : "rgba(255,255,255,0.72)") : undefined;
  const borderColor = hasVideo ? (textScheme === "dark" ? "rgba(10,10,10,0.2)" : "rgba(255,255,255,0.2)") : undefined;

  return (
    <section
      className="public-hero relative overflow-hidden"
      data-public-hero={size}
      data-hero-has-video={hasVideo ? "true" : "false"}
    >
      {hasVideo && videoPlaybackId ? (
        <PublicHeroVideo
          playbackId={videoPlaybackId}
          stillUrl={stillUrl ?? null}
          title={universeTitle}
        />
      ) : null}

      <PublicHeroParallax enabled={display}>
        <div
          className={`relative z-10 mx-auto max-w-7xl px-6 ${
            display ? "py-24 md:py-36" : "py-10 md:py-14"
          }`}
        >
          <div
            className={
              aside
                ? "flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                : undefined
            }
          >
            <div className={display ? "max-w-3xl space-y-7" : "max-w-3xl space-y-3"}>
              {kicker ? <div className="text-xs" style={fgMuted ? { color: fgMuted } : undefined}>{kicker}</div> : null}
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
                {eyebrow}
              </p>
              <h1
                className={
                  display
                    ? "text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl"
                    : "text-3xl font-semibold tracking-tight text-foreground md:text-5xl"
                }
                style={{ fontFamily: "var(--font-display, inherit)", ...(fg ? { color: fg } : {}) }}
              >
                {title}
              </h1>
              {description ? (
                <div
                  className={
                    display
                      ? "max-w-lg text-lg leading-relaxed text-muted-foreground"
                      : "max-w-2xl text-sm text-muted-foreground"
                  }
                  style={fgMuted ? { color: fgMuted } : undefined}
                >
                  {description}
                </div>
              ) : null}
              {actions ? (
                <div className={`flex flex-wrap gap-3 ${display ? "pt-2" : "pt-1"}`}>
                  {actions}
                </div>
              ) : null}
            </div>
            {aside ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div> : null}
          </div>
          {stats && stats.length > 0 ? (
            <div className="mt-16 flex flex-wrap gap-8 border-t pt-8" style={borderColor ? { borderColor } : undefined}>
              {stats.map(({ n, label }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span
                    className="text-3xl font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-display, inherit)", ...(fg ? { color: fg } : {}) }}
                  >
                    {n}
                  </span>
                  <span className="text-xs uppercase tracking-widest" style={fgMuted ? { color: fgMuted } : undefined}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </PublicHeroParallax>
    </section>
  );
}

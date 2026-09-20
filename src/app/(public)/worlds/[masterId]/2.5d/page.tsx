export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import { SpatialPresentation } from "@/components/experience/spatial-presentation";
import ExperienceToggle from "@/components/experience-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { public2_5dHref, publicHolographicHref, publicWorldHref } from "@/lib/experience/destinations";
import { muxThumbnailUrl } from "@/lib/media/thumbnail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  const title = data?.title ?? "Universe";
  return { title: `${title} · 2.5D` };
}

export default async function SpatialWorldPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ scene?: string }>;
}) {
  const { masterId } = await params;
  const { scene: sceneId } = await searchParams;

  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();
  // notFound() throws — TypeScript doesn't narrow through it, so assert here.
  const assembly = data!;

  const source = await loadSuiteSourcePreview(assembly);
  if (!source) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 bg-card/20">
          <div className="mx-auto max-w-7xl px-6 py-3">
            <Link
              href={publicWorldHref(masterId)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Universe
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">
          This Universe has no spatial stage yet.
        </p>
      </div>
    );
  }

  const title = assembly.title ?? "Universe";
  const mural = assembly.murals[0] ?? null;

  // If a scene param is present, seek to that scene's start_ms on load.
  let initialSeekMs: number | null = null;
  if (sceneId) {
    const window = source.windows.find((w) => w.scene_master_id === sceneId);
    if (window) initialSeekMs = window.start_ms;
  }

  const posterUrl = muxThumbnailUrl(source.playback_id, 1, 960);

  const clock = {
    endpoint_ref: source.endpoint_ref,
    projection_id: source.mural_projection_id,
    master_id: source.mural_id,
    canonical_state_id: source.mural_canonical_state_id ?? source.mural_id,
    start_ms: 0,
    end_ms: source.duration_ms,
    duration_ms: source.duration_ms,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Link
            href={publicWorldHref(masterId)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Universe · {title}
          </Link>
        </div>
      </div>

      <div className="mv-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">2.5D</p>
              <h1
                className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>
              {assembly.description ? (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                  {assembly.description.length > 160 ? assembly.description.slice(0, 160).trimEnd() + "…" : assembly.description}
                </p>
              ) : (
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                  Spatial presentation. Move your pointer to shift the viewer perspective.
                  Depth is synthetic until a genuine depth asset is available.
                </p>
              )}
            </div>
            <ExperienceToggle
              universeHref={publicWorldHref(masterId)}
              spatialHref={public2_5dHref(masterId)}
              experienceHref={publicHolographicHref(masterId)}
              current="spatial"
            />
          </div>
        </div>
      </div>

      <SpatialPresentation
        clock={clock}
        posterUrl={posterUrl}
        title={title}
        initialSeekMs={initialSeekMs}
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap gap-2">
          <Link href={publicWorldHref(masterId)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Return to Universe
          </Link>
          {mural ? (
            <Link href={`/worlds/${mural.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View Mural
            </Link>
          ) : null}
          {source.windows.length > 0 ? (
            <Link href={`/worlds/${masterId}/scenes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Scene Deck
            </Link>
          ) : null}
          <Link href={publicHolographicHref(masterId)} className={cn(buttonVariants({ size: "sm" }))}>
            Holographic Experience
          </Link>
        </div>
      </div>
    </div>
  );
}

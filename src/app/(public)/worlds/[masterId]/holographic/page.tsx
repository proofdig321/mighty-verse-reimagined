import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { loadSuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import { loadUniverseProductionResults } from "@/lib/assemble/load-production";
import { productionLayersFromResults } from "@/lib/production/projection";
import { composeHolographicProgram, type ExperienceSurfaceLinks } from "@/lib/experience/holographic-program";
import { HolographicStage } from "@/components/experience/holographic-stage";
import ExperienceToggle from "@/components/experience-toggle";
import { public2_5dHref } from "@/lib/experience/destinations";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  return { title: data ? `${data.title ?? "Universe"} · Holographic Experience` : "Holographic Experience" };
}

export default async function HolographicWorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();
  const assembly = data!;
  const [intelligence, productionResults, source] = await Promise.all([
    loadSentinelIntelligence(assembly, { includeObservations: false }),
    loadUniverseProductionResults(assembly.master_id),
    loadSuiteSourcePreview(assembly),
  ]);
  const title = assembly.title ?? "Universe";
  const program = composeHolographicProgram({
    title,
    layers: intelligence?.holographic ?? [],
    realizations: productionLayersFromResults(productionResults),
    source,
    moments: assembly.creative_moments,
  });
  const mural = assembly.murals[0] ?? null;
  const scenes = mural?.scenes ?? [];
  const links: ExperienceSurfaceLinks = {
    universeHref: `/worlds/${assembly.master_id}`,
    muralHref: mural ? `/worlds/${mural.master_id}` : null,
    sceneDeckHref: scenes.length > 0 ? `/worlds/${assembly.master_id}/scenes` : null,
    sceneHref: Object.fromEntries(
      scenes.map((scene) => [
        scene.master_id,
        scene.projection_id ? `/moments/${scene.projection_id}` : `/worlds/${assembly.master_id}/scenes`,
      ]),
    ),
    momentHref: Object.fromEntries(
      assembly.creative_moments.map((moment) => [moment.master_id, `/creative-moments/${moment.master_id}`]),
    ),
  };

  return (
    <div className="min-h-screen bg-background">

      <div className="border-b border-border/50 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Link
            href={`/worlds/${assembly.master_id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            Universe · {title}
          </Link>
        </div>
      </div>

      <div className="mv-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Holographic Experience</p>
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
                  Play the mural. Scenes, Creative Moments, and approved production sit in their own regions beneath the cinema.
                </p>
              )}
            </div>
            <ExperienceToggle
              universeHref={`/worlds/${assembly.master_id}`}
              spatialHref={public2_5dHref(assembly.master_id)}
              experienceHref={`/worlds/${assembly.master_id}/holographic`}
              current="experience"
            />
          </div>
        </div>
      </div>

      {program.clock || program.layers.length > 0 ? (
        <HolographicStage program={program} mode="public" links={links} />
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Alert>
            <AlertDescription>
              This Universe has no spatial stage yet. The Mural must be authorised and have media attached before the Holographic Experience is available.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap gap-2">
          <Link href={`/worlds/${assembly.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Return to Universe
          </Link>
          {mural ? (
            <Link href={`/worlds/${mural.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View Mural
            </Link>
          ) : null}
          {scenes.length > 0 ? (
            <Link href={`/worlds/${assembly.master_id}/scenes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Scene Deck
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

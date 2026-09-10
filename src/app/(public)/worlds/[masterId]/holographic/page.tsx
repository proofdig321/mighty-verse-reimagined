import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { loadSuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import { loadUniverseProductionResults } from "@/lib/assemble/load-production";
import { productionLayersFromResults } from "@/lib/production/projection";
import { composeHolographicProgram } from "@/lib/experience/holographic-program";
import { HolographicStage } from "@/components/experience/holographic-stage";
import ExperienceToggle from "@/components/experience-toggle";
import PageTopNav from "@/components/page-top-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  return { title: data ? `${data.title ?? "Universe"} · Experience` : "Experience" };
}

export default async function HolographicWorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();
  const [intelligence, productionResults, source] = await Promise.all([
    loadSentinelIntelligence(data, { includeObservations: false }),
    loadUniverseProductionResults(data.master_id),
    loadSuiteSourcePreview(data),
  ]);
  const title = data.title ?? "Universe";
  const program = composeHolographicProgram({
    title,
    layers: intelligence?.holographic ?? [],
    realizations: productionLayersFromResults(productionResults),
    source,
  });
  const mural = data.murals[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <PageTopNav />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Experience</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
              {title}
            </h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Play the mural. Scenes move through the composition in time. Creative Moments stand with the
              Scenes they belong to.
              {program.production_count > 0
                ? ` ${program.production_count} approved realization${program.production_count === 1 ? "" : "s"} join the stage.`
                : ""}
            </p>
          </div>
          <ExperienceToggle
            universeHref={`/worlds/${data.master_id}`}
            experienceHref={`/worlds/${data.master_id}/holographic`}
            current="experience"
          />
        </div>

        {intelligence ? (
          <HolographicStage program={program} mode="public" />
        ) : (
          <p className="text-sm text-muted-foreground">This Universe has no spatial stage yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href={`/worlds/${data.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Return to Universe
          </Link>
          {mural ? (
            <Link href={`/worlds/${mural.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View Mural
            </Link>
          ) : null}
          <Link href={`/worlds/${data.master_id}/scenes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Scene Deck
          </Link>
        </div>
      </main>
    </div>
  );
}

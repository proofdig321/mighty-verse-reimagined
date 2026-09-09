import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { loadUniverseProductionResults } from "@/lib/assemble/load-production";
import { composeExperienceProjection, productionLayersFromResults } from "@/lib/production/projection";
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
  const [intelligence, productionResults] = await Promise.all([
    loadSentinelIntelligence(data, { includeObservations: false }),
    loadUniverseProductionResults(data.master_id),
  ]);
  const title = data.title ?? "Universe";
  const projection = composeExperienceProjection({
    canonical_layers: intelligence?.holographic ?? [],
    realizations: productionLayersFromResults(productionResults),
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
              The Mural is the audiovisual foundation. Scenes are spatial units. Creative Moments stand in front of
              their Scenes. Approved production realizations appear on the Scenes they realize. They do not replace
              canonical Scenes.
              {projection.production_count > 0
                ? ` ${projection.production_count} approved production layer${projection.production_count === 1 ? "" : "s"} attached.`
                : " No approved production layers are attached yet."}
            </p>
          </div>
          <ExperienceToggle
            universeHref={`/worlds/${data.master_id}`}
            experienceHref={`/worlds/${data.master_id}/holographic`}
            current="experience"
          />
        </div>

        {intelligence ? (
          <HolographicStage title={title} layers={projection.layers} />
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

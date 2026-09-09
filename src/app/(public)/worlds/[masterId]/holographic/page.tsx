import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { loadUniverseAssembly } from "@/lib/assemble/load-universe";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
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
  return { title: data ? `${data.title ?? "Universe"} · 2.5D` : "2.5D" };
}

export default async function HolographicWorldPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();
  const intelligence = await loadSentinelIntelligence(data, { includeObservations: false });
  const title = data.title ?? "Universe";

  return (
    <div className="min-h-screen bg-background">
      <PageTopNav />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">2.5D holographic</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
              {title}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Creative Moments become spatial objects in front of their Scenes. The Mural is the back plane.
              This is Experience presentation. Canonical windows stay on the Creative Suite.
            </p>
          </div>
          <ExperienceToggle
            twoDHref={`/worlds/${data.master_id}`}
            holographicHref={`/worlds/${data.master_id}/holographic`}
            current="2.5d"
          />
        </div>

        {intelligence ? (
          <HolographicStage title={title} layers={intelligence.holographic} />
        ) : (
          <p className="text-sm text-muted-foreground">This Universe has no spatial stage yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href={`/worlds/${data.master_id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Return to 2D world
          </Link>
          <Link href={`/worlds/${data.master_id}/scenes`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Scene Deck
          </Link>
        </div>
      </main>
    </div>
  );
}

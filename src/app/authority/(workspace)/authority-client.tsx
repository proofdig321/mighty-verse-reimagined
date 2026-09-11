"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Globe, MonitorPlay, Sparkles, Upload, Users, Wand2 } from "lucide-react";
import { api, type AuthorityData } from "./_shared/authority-utils";
import { CREATIVE_STUDIO_HREF, EXPERIENCE_JOURNEY_HREF } from "@/lib/product-nav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const JOURNEY = [
  { step: "01", label: "Create Work", sub: "Establish the work. YouTube is the primary ingest path.", href: "/authority/create", surface: "create", icon: Upload },
  { step: "02", label: "Curate", sub: "Shape an existing Universe from live state.", href: "/authority/curate", surface: "curate", icon: Wand2 },
  { step: "03", label: "Creative Studio", sub: "Storyboard, Scenes, Production, 2.5D, Experience.", href: CREATIVE_STUDIO_HREF, surface: "studio", icon: MonitorPlay },
  { step: "04", label: "Experience", sub: "Open a Universe, then enter the public Experience.", href: EXPERIENCE_JOURNEY_HREF, surface: "experience", icon: Sparkles },
] as const;

const SURFACES = [
  { label: "Discover", sub: "Public Universes catalog.", href: "/universes", surface: "discover", icon: Globe },
  { label: "Creative Studio", sub: "Start from an idea, or open an existing Universe.", href: CREATIVE_STUDIO_HREF, surface: "studio-entry", icon: MonitorPlay },
  { label: "Public Experience", sub: "Choose a Universe, then enter Experience.", href: EXPERIENCE_JOURNEY_HREF, surface: "public-experience", icon: Clapperboard },
] as const;

const OPERATIONS = [
  { label: "Media Library", sub: "Incoming assets and Mux playback", href: "/authority/media", icon: Clapperboard },
  { label: "Proof of Rights", sub: "Rights, provenance, ISRC prefix", href: "/authority/proof-of-rights", icon: Sparkles },
  { label: "Universes", sub: "Canonical containers", href: "/authority/universes", icon: Globe },
  { label: "Participants", sub: "People and roles", href: "/authority/participants", icon: Users },
] as const;

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/authority").then((d) => {
      if (d.error) setError(d.error);
      else setData(d);
    });
  }, []);

  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground p-6 text-sm animate-pulse">Loading…</p>;

  const { authority } = data;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {authority.scope_type} scope
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Authority Console</h1>
        <p className="text-sm text-muted-foreground">
          Establish the work in Create. Shape it in Curate. Compose it in Creative Studio. Experience it in public.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Creative journey</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            CREATE → CURATE → CREATIVE STUDIO → EXPERIENCE. Sentinel observes throughout. It does not decide canonical meaning.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {JOURNEY.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} data-dashboard-surface={item.surface}>
                <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{item.step}</span>
                      <Icon size={16} className="text-muted-foreground" />
                    </div>
                    <CardTitle>{item.label}</CardTitle>
                    <CardDescription>{item.sub}</CardDescription>
                  </CardHeader>
                  <CardFooter className="text-xs text-muted-foreground">
                    Continue <ArrowRight size={12} />
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product surfaces</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Discover → Reveal → Assemble → Experience. These controls open the mounted product, not slogans.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SURFACES.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} data-dashboard-surface={item.surface}>
                <Card className="h-full bg-card/80 transition-colors hover:bg-accent/20">
                  <CardHeader>
                    <Icon size={16} className="text-muted-foreground" />
                    <CardTitle>{item.label}</CardTitle>
                    <CardDescription>{item.sub}</CardDescription>
                  </CardHeader>
                  <CardFooter className="text-xs text-muted-foreground">
                    Open <ArrowRight size={12} />
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operations</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Catalogues and rights live on their own pages. This console does not list every master.
          </p>
        </div>
        <Card className="bg-card/80">
          <CardContent className="divide-y divide-border p-0">
            {OPERATIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent/30">
                  <div className="flex items-center gap-3">
                    <Icon size={15} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground/60">{item.sub}</p>
                    </div>
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground/30" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Link href="/studio/work" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Open storyboard workspace
        </Link>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Globe, Sparkles, Users } from "lucide-react";
import { api, type AuthorityData } from "./_shared/authority-utils";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          Create Work and Curate live in the sidebar. Creative Studio is a workstation, not a dashboard card.
          Discover Home, Universes, and Gallery already live on the public product.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operations</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Catalogues and rights live on their own pages. This console does not remount public Experience.
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

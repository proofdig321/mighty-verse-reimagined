"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api, type AuthorityData } from "./_shared/authority-utils";
import { CREATIVE_STUDIO_HREF, EXPERIENCE_JOURNEY_HREF } from "@/lib/product-nav";

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
    <div className="space-y-12">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {authority.scope_type} scope
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Authority Console</h1>
        <p className="text-sm text-muted-foreground">
          Establish the work in Create. Shape it in Curate. Compose it in Creative Studio. Experience it in public.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Creative journey</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            CREATE → CURATE → CREATIVE STUDIO → EXPERIENCE. Sentinel observes throughout. It does not decide canonical meaning.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {[
            { step: "01", label: "Create Work", sub: "Establish the work. YouTube is the primary ingest path. Video processing continues on the work record if you leave.", href: "/authority/create", surface: "create" },
            { step: "02", label: "Curate", sub: "Shape an existing Universe from live state. Not a second Create wizard.", href: "/authority/curate", surface: "curate" },
            { step: "03", label: "Creative Studio", sub: "Open workspaces: Overview, Storyboard, Scenes, Production, 2.5D, Experience.", href: CREATIVE_STUDIO_HREF, surface: "studio" },
            { step: "04", label: "Experience", sub: "Open a Universe, then enter the public Experience. Distinct from Studio preview.", href: EXPERIENCE_JOURNEY_HREF, surface: "experience" },
          ].map((item) => (
            <Link key={item.label} href={item.href} data-dashboard-surface={item.surface} className="group bg-card px-5 py-4 transition-colors hover:bg-accent/30">
              <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{item.step}</span>
              <p className="mt-2 text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{item.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                Continue <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product surfaces</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Discover → Reveal → Assemble → Experience. These controls open the mounted product, not slogans.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {[
            { label: "Discover", sub: "Public Universes catalog.", href: "/universes", surface: "discover" },
            { label: "Creative Studio", sub: "Start from an idea, or open an existing Universe.", href: CREATIVE_STUDIO_HREF, surface: "studio-entry" },
            { label: "Public Experience", sub: "Choose a Universe, then enter Experience.", href: EXPERIENCE_JOURNEY_HREF, surface: "public-experience" },
          ].map((item) => (
            <Link key={item.label} href={item.href} data-dashboard-surface={item.surface} className="group bg-card px-5 py-4 transition-colors hover:bg-accent/30">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{item.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                Open <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operations</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Catalogues and rights live on their own pages. This console does not list every master.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Media Library", sub: "Incoming assets and Mux playback", href: "/authority/media" },
            { label: "Proof of Rights", sub: "Rights, provenance, ISRC prefix", href: "/authority/proof-of-rights" },
            { label: "Universes", sub: "Canonical containers", href: "/authority/universes" },
            { label: "Participants", sub: "People and roles", href: "/authority/participants" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="group bg-card px-5 py-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">{item.sub}</p>
              </div>
              <ArrowRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

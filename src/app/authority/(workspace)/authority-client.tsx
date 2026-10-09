"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Film,
  Globe,
  ShieldCheck,
  Sparkles,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { api, type AuthorityData, getWorkStatus, WORK_TYPE_LABELS } from "./_shared/authority-utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { HeroConfigPanel } from "@/components/assemble/hero-config-panel";
import { StudioSection } from "@/components/assemble/studio-section";
import { StudioEmptyState } from "@/components/assemble/studio-empty-state";

const OPERATIONS = [
  { label: "Media Library", sub: "Incoming assets and Mux playback", href: "/authority/media", icon: Film },
  { label: "Proof of Rights", sub: "Rights, provenance, ISRC prefix", href: "/authority/proof-of-rights", icon: ShieldCheck },
  { label: "Universes", sub: "Canonical containers", href: "/authority/universes", icon: Globe },
  { label: "Participants", sub: "People and roles", href: "/authority/participants", icon: Users },
] as const;

const CATALOGUE_TYPES = [
  { label: "Universes", type: "universe", href: "/authority/universes", icon: Globe },
  { label: "Murals", type: "mural", href: "/authority/murals", icon: Clapperboard },
  { label: "Scenes", type: "scene", href: "/authority/scenes", icon: Sparkles },
  { label: "Creative Moments", type: "creative-moment", href: "/authority/creative-moments", icon: Users },
] as const;

function StatusBadge({ needs }: { needs: string }) {
  if (needs === "Ready") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 size={10} />Ready
      </Badge>
    );
  }
  if (needs === "Needs authorisation") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400">
        <Clock size={10} />{needs}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
      <AlertCircle size={10} />{needs}
    </Badge>
  );
}

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/authority").then((d) => {
      if (d.error) setError(d.error);
      else setData(d);
    });
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle size={14} />
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  const { authority, masters, states, projections, bindings, presentations, projectionPresentations, realizations } = data;

  const workItems = masters.slice(0, 8).map((master) => {
    const state = states.find((s) => s.master_id === master.master_id);
    const projection = projections.find((p) => p.master_id === master.master_id);
    const binding = bindings.find((b) => b.projection_id === projection?.projection_id);
    const presentation = presentations.find((p) => p.master_id === master.master_id);
    const projectionPresentation = projectionPresentations.find((p) => p.projection_id === projection?.projection_id);
    const status = getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations, master.master_id);
    const title = presentation?.title ?? WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
    return { master, title, status };
  });

  const needsAttention = workItems.filter((w) => !w.status.ready);
  const ready = workItems.filter((w) => w.status.ready);

  const universeOptions = masters
    .filter((m) => m.canonical_type === "universe")
    .map((m) => ({
      master_id: m.master_id,
      title: presentations.find((p) => p.master_id === m.master_id)?.title ?? null,
    }));

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <p className="suite-kicker">{authority.scope_type} scope</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Authority Console</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Operational surfaces. Create Work and Curate live in the sidebar.
          Public Discovery, Gallery, and Creative Studio are separate product surfaces.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/authority/create" className={cn(buttonVariants({ size: "sm" }))}>
          Create Work
        </Link>
        <Link href="/authority/curate" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Curate
        </Link>
        <Link href="/studio" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Creative Studio
        </Link>
      </div>

      <Separator />

      {/* Work requiring attention */}
      {needsAttention.length > 0 && (
        <StudioSection
          id="work-attention"
          label="Needs attention"
          aside={
            <p className="text-xs text-muted-foreground/60">
              {needsAttention.length} work item{needsAttention.length !== 1 ? "s" : ""} incomplete
            </p>
          }
        >
          <div className="studio-composer p-0 overflow-hidden">
            {needsAttention.map(({ master, title, status }) => (
              <Link
                key={master.master_id}
                href={`/authority/${master.master_id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-accent/30 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clapperboard size={13} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{title}</p>
                    <p className="text-xs text-muted-foreground/60 capitalize">{master.canonical_type.replace(/-/g, " ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge needs={status.needs} />
                  <ArrowRight size={12} className="text-muted-foreground/30" />
                </div>
              </Link>
            ))}
          </div>
        </StudioSection>
      )}

      {/* Ready work */}
      {ready.length > 0 && (
        <StudioSection id="work-ready" label={`Ready · ${ready.length} item${ready.length !== 1 ? "s" : ""}`}>
          <div className="studio-composer p-0 overflow-hidden">
            {ready.map(({ master, title }) => (
              <Link
                key={master.master_id}
                href={`/authority/${master.master_id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/30 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 size={13} className="shrink-0 text-muted-foreground/50" />
                  <p className="text-sm text-foreground truncate">{title}</p>
                </div>
                <ArrowRight size={12} className="text-muted-foreground/30 shrink-0" />
              </Link>
            ))}
          </div>
        </StudioSection>
      )}

      {masters.length === 0 && (
        <StudioEmptyState
          kicker="Work"
          title="No work yet"
          body="Create your first Universe to begin."
          action={
            <Link href="/authority/create" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
              Create Work
            </Link>
          }
        />
      )}

      <Separator />

      {/* Operations */}
      <StudioSection id="operations" label="Operations">
        <div className="studio-composer p-0 overflow-hidden">
          {OPERATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-accent/30 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Icon size={14} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground/60">{item.sub}</p>
                  </div>
                </div>
                <ArrowRight size={13} className="text-muted-foreground/30" />
              </Link>
            );
          })}
        </div>
      </StudioSection>

      {/* Catalogue counts */}
      <StudioSection id="catalogue" label="Catalogue">
        <dl className="studio-command-grid">
          {CATALOGUE_TYPES.map(({ label, type, href, icon: Icon }) => (
            <div key={label} className="studio-command-card">
              <Link href={href}>
                <dt className="suite-kicker flex items-center gap-1.5">
                  <Icon size={10} />
                  {label}
                </dt>
                <dd className="text-lg font-medium text-foreground mt-1">
                  {masters.filter((m) => m.canonical_type === type).length}
                </dd>
              </Link>
            </div>
          ))}
        </dl>
      </StudioSection>

      {/* Public home configuration */}
      <StudioSection id="public-home" label="Public Home">
        <HeroConfigPanel universes={universeOptions} />
      </StudioSection>
    </div>
  );
}

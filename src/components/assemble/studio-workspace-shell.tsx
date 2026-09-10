import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { creativeSuiteIdentityHref, curateHubHref } from "@/lib/assemble/studio";
import { creativeSuiteNavItems, type CreativeSuiteSectionId } from "@/lib/assemble/suite";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { CreativeSuiteNav } from "./creative-suite-nav";
import { StudioHashRedirect } from "./studio-hash-redirect";
import { cn } from "@/lib/utils";

export function StudioWorkspaceShell({
  universeId,
  title,
  description,
  current,
  suiteHref,
  fromCurate,
  workspaceLabel,
  lead,
  showIdentityAction = true,
  actions,
  children,
}: {
  universeId: string;
  title: string;
  description?: string | null;
  current: CreativeSuiteSectionId;
  suiteHref: string;
  fromCurate: boolean;
  workspaceLabel?: string;
  lead?: string;
  showIdentityAction?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const overviewItems = fromCurate
    ? [
        { label: "Authority", href: "/authority" },
        { label: "Curate", href: curateHubHref(universeId) },
        { label: title, href: current === "overview" ? undefined : suiteHref },
      ]
    : [
        { label: "Creative Studio", href: "/studio" },
        { label: title, href: current === "overview" ? undefined : suiteHref },
      ];
  const items = workspaceLabel ? [...overviewItems, { label: workspaceLabel }] : overviewItems;

  return (
    <div className="studio-workspace space-y-8">
      <StudioHashRedirect suiteHref={suiteHref} />
      <HierarchyBreadcrumb items={items} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Creative Studio
          </p>
          <h1
            className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {title}
          </h1>
          {description ? <p className="max-w-3xl text-base text-foreground/80">{description}</p> : null}
          {lead ? <p className="max-w-3xl text-sm text-muted-foreground">{lead}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {actions}
          <Link
            href={`/worlds/${universeId}/holographic`}
            className={buttonVariants({ size: "sm" })}
            data-experience-entry="experience"
          >
            Enter Experience
          </Link>
          <Link href={`/worlds/${universeId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open Universe
          </Link>
          {showIdentityAction ? (
            <Link
              href={creativeSuiteIdentityHref(universeId, fromCurate ? "curate" : null)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit identity
            </Link>
          ) : null}
          <Link href={`/authority/${universeId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Canonical record
          </Link>
        </div>
      </div>

      <CreativeSuiteNav items={creativeSuiteNavItems(suiteHref)} current={current === "identity" ? undefined : current} />

      <div className="studio-canvas">{children}</div>
    </div>
  );
}

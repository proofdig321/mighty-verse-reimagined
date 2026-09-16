import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { creativeSuiteIdentityHref, curateHubHref } from "@/lib/assemble/studio";
import { creativeSuiteNavGroups, studioLibraryHrefs, type CreativeSuiteSectionId } from "@/lib/assemble/suite";
import type { StudioWorkspace } from "@/lib/assemble/load-studio-workspace";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { CreativeSuiteNav } from "./creative-suite-nav";
import { StudioHashRedirect } from "./studio-hash-redirect";
import { cn } from "@/lib/utils";

export function studioShellFromWorkspace(
  workspace: StudioWorkspace,
  current: CreativeSuiteSectionId,
  workspaceLabel?: string,
) {
  return {
    universeId: workspace.data.master_id,
    title: workspace.data.title ?? "Untitled universe",
    description: workspace.data.description,
    current,
    suiteHref: workspace.suiteHref,
    fromCurate: workspace.fromCurate,
    workspaceLabel,
    sceneCount: workspace.sceneCount,
  };
}

export function StudioWorkspaceShell({
  universeId,
  title,
  description,
  current,
  suiteHref,
  fromCurate,
  workspaceLabel,
  lead,
  sceneCount,
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
  sceneCount?: number;
  showIdentityAction?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const overviewItems = fromCurate
    ? [
        { label: "Studio", href: "/studio" },
        { label: "Curate", href: curateHubHref(universeId) },
        { label: title, href: current === "overview" ? undefined : suiteHref },
      ]
    : [
        { label: "Studio", href: "/studio" },
        { label: title, href: current === "overview" ? undefined : suiteHref },
      ];
  const items = workspaceLabel ? [...overviewItems, { label: workspaceLabel }] : overviewItems;
  const groups = creativeSuiteNavGroups(suiteHref);

  return (
    <div className="studio-workspace" data-studio-layout="composer">
      <StudioHashRedirect suiteHref={suiteHref} />
      <aside className="studio-workspace-rail">
        <CreativeSuiteNav groups={groups} current={current === "identity" ? undefined : current} library={studioLibraryHrefs(suiteHref)} />
      </aside>
      <div className="studio-workspace-main">
        <header className="studio-workspace-header">
          <HierarchyBreadcrumb items={items} />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Studio</p>
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>
              {description ? <p className="max-w-3xl text-sm text-foreground/80">{description}</p> : null}
              <p className="text-xs text-muted-foreground">
                {workspaceLabel ?? "Source"}
                {typeof sceneCount === "number" ? ` · ${sceneCount} Scene${sceneCount === 1 ? "" : "s"}` : ""}
                {lead ? ` · ${lead}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {actions}
              <Link href={`/worlds/${universeId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Enter 2.5D
              </Link>
              <Link
                href={`/worlds/${universeId}/holographic`}
                className={buttonVariants({ size: "sm" })}
                data-experience-entry="holographic"
              >
                Holographic Experience
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
        </header>
        <div className="studio-canvas">{children}</div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { creativeSuiteIdentityHref, curateHubHref } from "@/lib/assemble/studio";
import { creativeSuiteNavGroups, studioLibraryHrefs, type CreativeSuiteSectionId } from "@/lib/assemble/suite";
import type { StudioWorkspace } from "@/lib/assemble/load-studio-workspace";
import { Badge } from "@/components/ui/badge";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { CreativeSuiteNav } from "./creative-suite-nav";
import { StudioHashRedirect } from "./studio-hash-redirect";
import { StudioHeaderActions } from "./studio-header-actions";
import { StudioRail } from "./studio-rail";

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
      <StudioRail>
        <CreativeSuiteNav groups={groups} current={current === "identity" ? undefined : current} library={studioLibraryHrefs(suiteHref)} />
      </StudioRail>
      <div className="studio-workspace-main">
        <header className="studio-workspace-header">
          <HierarchyBreadcrumb items={items} />
          <div className="studio-workspace-heading">
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Studio</p>
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-display, inherit)" }}
              >
                {title}
              </h1>
              {description ? <p className="studio-workspace-lead">{description}</p> : null}
              <div className="studio-workspace-meta">
                <Badge variant="outline">{workspaceLabel ?? "Source"}</Badge>
                {typeof sceneCount === "number" ? (
                  <Badge variant="secondary">
                    {sceneCount} Scene{sceneCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {lead ? <span className="text-xs text-muted-foreground">{lead}</span> : null}
              </div>
            </div>
            <StudioHeaderActions
              universeId={universeId}
              identityHref={showIdentityAction ? creativeSuiteIdentityHref(universeId, fromCurate ? "curate" : null) : null}
              showIdentityAction={showIdentityAction}
              extra={actions}
            />
          </div>
        </header>
        <div className="studio-canvas">{children}</div>
      </div>
    </div>
  );
}

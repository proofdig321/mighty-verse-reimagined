"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { occupancyLabel } from "@/lib/assemble/occupancy";
import { curateHubHref } from "@/lib/assemble/studio";
import type { StudioUniverseLandingCard } from "@/lib/assemble/studio-landing";
import { cn } from "@/lib/utils";
import { CATALOGUE_PAGE_SIZE, PaginatedItems } from "./collection-pager";
import { WithdrawWork } from "./withdraw-work";

export function UniverseProjectList({ projects }: { projects: StudioUniverseLandingCard[] }) {
  return (
    <PaginatedItems items={projects} pageSize={CATALOGUE_PAGE_SIZE} label="Universe projects">
      {(page) => (
        <ul className="grid gap-3 sm:grid-cols-2">
          {page.map((project) => (
            <li key={project.master_id}>
              <UniverseProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </PaginatedItems>
  );
}

function UniverseProjectCard({ project }: { project: StudioUniverseLandingCard }) {
  const openHref = project.occupancy === "curated" ? project.href : curateHubHref(project.master_id);
  const openLabel = project.occupancy === "curated" ? "Open workspace" : "Open Curate Hub";

  return (
    <Card className="h-full bg-card/80" data-occupancy={project.occupancy} data-universe-project={project.master_id}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Universe</p>
          <Badge variant={project.occupancy === "orphan" ? "destructive" : "outline"}>
            {occupancyLabel(project.occupancy)}
          </Badge>
        </div>
        <CardTitle>
          <Link href={openHref} className="hover:underline">
            {project.title}
          </Link>
        </CardTitle>
        {project.description ? (
          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {project.attached_work_count
            ? `${project.attached_work_count} attached storyboard${project.attached_work_count === 1 ? "" : "s"} · non-canonical`
            : "No attached storyboard"}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Link
          href={`/authority/universes/${project.master_id}/identity`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Edit
        </Link>
        <Link href={openHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
          {openLabel}
        </Link>
        {project.withdrawable ? (
          <WithdrawWork masterId={project.master_id} title={project.title} occupancy={project.occupancy} />
        ) : null}
      </CardFooter>
    </Card>
  );
}

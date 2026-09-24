"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { curateHubHref } from "@/lib/assemble/studio";
import type { AuthoringSnapshot } from "@/lib/storyboard/history";

export function StoryboardAssemblyBar({
  assemblyItems,
  panelCount,
  universeId,
  onAddSelected,
  canAddSelected,
}: {
  assemblyItems: AuthoringSnapshot["assembly"];
  panelCount: number;
  universeId: string | null;
  onAddSelected: () => void;
  canAddSelected: boolean;
}) {
  const ready = assemblyItems.length;
  const pending = Math.max(0, panelCount - ready);

  return (
    <footer className="border-t border-border/60 bg-background/80 px-4 py-2 flex flex-wrap items-center gap-4 text-sm" aria-label="Assembly">
      <div className="flex-1 min-w-0">
        <span className="suite-kicker mr-2">Assembly</span>
        {ready > 0 ? (
          <span className="suite-kicker normal-case tracking-normal font-normal text-foreground">
            {ready} / {panelCount} panel{panelCount !== 1 ? "s" : ""} ready
            <span className="ml-2 text-muted-foreground">Non-canonical · Requires curation</span>
          </span>
        ) : pending > 0 ? (
          <span className="suite-kicker normal-case tracking-normal font-normal">
            {pending} panel{pending !== 1 ? "s" : ""} still need realization
            <span className="ml-2">This assembly remains non-canonical until curated.</span>
          </span>
        ) : (
          <span className="suite-kicker">No panels yet.</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canAddSelected && (
          <Button type="button" size="sm" variant="outline" onClick={onAddSelected}>
            Add selected to assembly
          </Button>
        )}
        {universeId ? (
          <Link href={curateHubHref(universeId)} className={cn(buttonVariants({ size: "sm" }))}>
            Submit for Curation
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Associate with a Universe to submit for curation.</p>
        )}
      </div>
    </footer>
  );
}

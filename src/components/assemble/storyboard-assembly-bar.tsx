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
  onPreview,
}: {
  assemblyItems: AuthoringSnapshot["assembly"];
  panelCount: number;
  universeId: string | null;
  onAddSelected: () => void;
  canAddSelected: boolean;
  onPreview?: () => void;
}) {
  const ready = assemblyItems.length;
  const pending = Math.max(0, panelCount - ready);

  return (
    <footer className="storyboard-assembly-bar" aria-label="Assembly">
      {/* Thumbnail strip — assembled panels */}
      {assemblyItems.length > 0 && (
        <div className="storyboard-assembly-strip">
          {assemblyItems.map((item, i) => (
            <div key={item.id} className="storyboard-assembly-thumb">
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 studio-panel-card-placeholder" />
              )}
              {item.kind === "motion" && (
                <span className="absolute top-0.5 right-0.5 text-[8px] text-white/70">▶</span>
              )}
              <span className="absolute bottom-0 inset-x-0 text-center font-mono text-[7px] text-white/60 bg-black/40 leading-tight py-px">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
          {/* Pending slots */}
          {pending > 0 && Array.from({ length: Math.min(pending, 4) }).map((_, i) => (
            <div key={`pending-${i}`} className="storyboard-assembly-thumb storyboard-assembly-thumb-pending">
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-muted-foreground/30">
                {String(ready + i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
          {pending > 4 && (
            <div className="storyboard-assembly-thumb-more">
              +{pending - 4}
            </div>
          )}
        </div>
      )}

      <div className="storyboard-assembly-meta">
        <div className="flex-1 min-w-0">
          <span className="suite-kicker mr-2">Assembly</span>
          {ready > 0 ? (
            <span className="suite-kicker normal-case tracking-normal font-normal text-foreground">
              {ready} / {panelCount} panel{panelCount !== 1 ? "s" : ""} ready
              <span className="ml-2 text-muted-foreground">· Non-canonical · Requires curation</span>
            </span>
          ) : pending > 0 ? (
            <span className="suite-kicker normal-case tracking-normal font-normal">
              {pending} panel{pending !== 1 ? "s" : ""} need realization
            </span>
          ) : (
            <span className="suite-kicker">No panels yet.</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canAddSelected && (
            <Button type="button" size="sm" variant="outline" onClick={onAddSelected}>
              Add to assembly
            </Button>
          )}
          {onPreview && panelCount > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={onPreview}>
              Preview
            </Button>
          )}
          {universeId ? (
            <Link href={curateHubHref(universeId)} className={cn(buttonVariants({ size: "sm" }))}>
              Submit for Curation
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground/60">Associate with a Universe to submit.</p>
          )}
        </div>
      </div>
    </footer>
  );
}

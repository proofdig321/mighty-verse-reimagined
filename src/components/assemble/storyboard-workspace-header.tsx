"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { AssociateStoryboard } from "./associate-storyboard";

type StoryboardWorkspaceHeaderProps = {
  universeId: string | null;
  backHref: string;
  workTitle: string;
  saveLabel: string;
  workAttached: boolean;
  universes: { master_id: string; title: string }[];
  workId: string | null;
  undoDisabled: boolean;
  redoDisabled: boolean;
  deleteVisible: boolean;
  onTitleChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onDelete: () => void;
  onSave: () => void;
};

export function StoryboardWorkspaceHeader({
  universeId,
  backHref,
  workTitle,
  saveLabel,
  workAttached,
  universes,
  workId,
  undoDisabled,
  redoDisabled,
  deleteVisible,
  onTitleChange,
  onUndo,
  onRedo,
  onReset,
  onDelete,
  onSave,
}: StoryboardWorkspaceHeaderProps) {
  return (
    <div className="storyboard-header px-4 py-2 border-b border-border/60 bg-card/60 backdrop-blur-sm">
      <div className="min-w-0 flex flex-wrap items-center gap-2">
        {universeId ? null : (
          <HierarchyBreadcrumb
            items={[
              { label: "Studio", href: "/studio" },
              { label: "Storyboard", href: backHref },
              { label: workTitle || "Untitled storyboard" },
            ]}
          />
        )}
        {universeId ? null : (
          <Link href={backHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            Back
          </Link>
        )}
        <Input
          aria-label="Work title"
          className="h-8 max-w-xs"
          value={workTitle}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground" data-save-state={saveLabel}>{saveLabel}</p>
        <p className="text-[11px] text-muted-foreground">
          {workAttached ? "Attached · non-canonical" : "Unattached · non-canonical"}
        </p>
        {universes.length > 0 && !universeId ? (
          <div className="min-w-[220px] max-w-md flex-1">
            <AssociateStoryboard universes={universes} workId={workId} />
          </div>
        ) : null}
      </div>
      <div className="storyboard-header-actions">
        <Button type="button" size="sm" variant="outline" disabled={undoDisabled} title={"Undo"} onClick={onUndo}>Undo</Button>
        <Button type="button" size="sm" variant="outline" disabled={redoDisabled} title={"Redo"} onClick={onRedo}>Redo</Button>
        <Button type="button" size="sm" variant="outline" onClick={onReset}>Reset</Button>
        {deleteVisible ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
        ) : null}
        <Button type="button" size="sm" onClick={onSave}>Save</Button>
      </div>
    </div>
  );
}

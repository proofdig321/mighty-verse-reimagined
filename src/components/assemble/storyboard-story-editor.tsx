"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ASSIST_ACTIONS } from "@/lib/storyboard/assist";
import type { StoryboardActionState } from "./use-storyboard-authoring-operations";

export function StoryboardStoryEditor({
  script,
  instruction,
  hasPanels,
  saveState,
  assistState,
  assistProposal,
  onScriptChange,
  onInstructionChange,
  onSave,
  onGenerate,
  onAssist,
  onApplyProposal,
  onDismissProposal,
}: {
  script: string;
  instruction: string;
  hasPanels: boolean;
  saveState: StoryboardActionState;
  assistState: StoryboardActionState;
  assistProposal: string | null;
  onScriptChange: (value: string) => void;
  onInstructionChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  onAssist: (actionId: string) => void;
  onApplyProposal: () => void;
  onDismissProposal: () => void;
}) {
  const [expanded, setExpanded] = useState(!hasPanels);

  return (
    <section className="space-y-3 border-b border-border/60 pb-4" aria-labelledby="storyboard-story-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="storyboard-story-heading" className="text-sm font-semibold">Story</h2>
          <p className="text-xs text-muted-foreground">Authored story and creative direction for the storyboard work.</p>
        </div>
        {hasPanels ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded((open) => !open)}>
            {expanded ? "Collapse" : "Edit story"}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3">
          <Textarea
            aria-label="Storyboard story"
            value={script}
            onChange={(event) => onScriptChange(event.target.value)}
            className="min-h-28 resize-y text-sm leading-relaxed"
            placeholder="Describe the story, action, and emotional turn you want the panels to carry."
          />
          <Textarea
            aria-label="Storyboard creative direction"
            value={instruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            className="min-h-16 resize-y text-sm"
            placeholder="Optional direction for AI assist or storyboard generation."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onGenerate} disabled={!script.trim() || saveState.status === "generating"}>
              Generate storyboard
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSave}>
              Save story
            </Button>
            {ASSIST_ACTIONS.slice(0, 3).map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAssist(action.id)}
                disabled={assistState.status === "generating"}
              >
                {action.label}
              </Button>
            ))}
          </div>

          {assistProposal !== null ? (
            <div className="space-y-3 border-l-2 border-primary/50 pl-3" aria-label="AI story proposal">
              <p className="text-xs font-medium">Proposed revision</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{assistProposal}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onApplyProposal}>Apply proposal</Button>
                <Button type="button" size="sm" variant="outline" onClick={onDismissProposal}>Discard</Button>
              </div>
            </div>
          ) : null}

          {saveState.status !== "idle" ? (
            <p className="text-xs text-muted-foreground" role={saveState.status === "failed" ? "alert" : undefined}>
              {saveState.message}
            </p>
          ) : null}
          {assistState.status !== "idle" ? (
            <p className="text-xs text-muted-foreground" role={assistState.status === "failed" || assistState.status === "unavailable" ? "status" : undefined}>
              {assistState.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

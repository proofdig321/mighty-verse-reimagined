"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type StudioComposeMode = "story" | "still" | "motion";

const MODES: { id: StudioComposeMode; label: string; provider: string }[] = [
  { id: "story", label: "Storyboard", provider: "Gemini" },
  { id: "still", label: "Still", provider: "Gemini" },
  { id: "motion", label: "Motion", provider: "Veo" },
];

export function StudioComposer({
  mode,
  onMode,
  directive,
  onDirective,
  placeholder,
  generateLabel,
  generateDisabled,
  generateTitle,
  onGenerate,
  chips,
  controls,
  status,
}: {
  mode: StudioComposeMode;
  onMode: (mode: StudioComposeMode) => void;
  directive: string;
  onDirective: (value: string) => void;
  placeholder: string;
  generateLabel: string;
  generateDisabled?: boolean;
  generateTitle?: string;
  onGenerate: () => void;
  chips?: ReactNode;
  controls?: ReactNode;
  status?: ReactNode;
}) {
  const provider = MODES.find((item) => item.id === mode)?.provider ?? "Gemini";
  return (
    <section className="studio-composer" aria-label="Creator composer">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Realization mode">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={cn("studio-composer-mode", mode === item.id && "studio-composer-mode-current")}
            onClick={() => onMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="block space-y-2">
        <span className="sr-only">Creator directive</span>
        <Textarea
          value={directive}
          onChange={(event) => onDirective(event.target.value)}
          className="studio-composer-input"
          placeholder={placeholder}
        />
      </label>
      {chips ? <div className="studio-composer-chips">{chips}</div> : null}
      <div className="studio-composer-bar">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{provider}</span>
          {mode === "motion" ? " · Mux delivers playable video" : mode === "still" ? " · still artifact, not a Scene" : " · structured Storyboard, not Scenes"}
        </p>
        {controls ? <div className="studio-composer-controls">{controls}</div> : null}
        <Button type="button" size="sm" disabled={generateDisabled} title={generateTitle ?? generateLabel} onClick={onGenerate}>
          {generateLabel}
        </Button>
      </div>
      {status}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Clapperboard,
  Images,
  Monitor,
  Smartphone,
  WandSparkles,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkbenchPanel = "work" | "source" | "create" | "results" | "preview" | "timeline" | "mobile";

const icons = {
  work: BookOpen,
  source: Images,
  create: WandSparkles,
  results: Clapperboard,
  preview: Monitor,
  timeline: Film,
  mobile: Smartphone,
};

const labels: { id: WorkbenchPanel; label: string }[] = [
  { id: "work", label: "My Storyboard" },
  { id: "source", label: "Source" },
  { id: "create", label: "Create" },
  { id: "results", label: "Results" },
  { id: "preview", label: "Preview" },
  { id: "timeline", label: "Timeline" },
  { id: "mobile", label: "Mobile View" },
];

export function StudioWorkbenchNav({
  workId,
  active,
  mobileView = false,
  onSourceOpen,
}: {
  workId: string | null;
  active: WorkbenchPanel;
  mobileView?: boolean;
  onSourceOpen?: () => void;
}) {

  const editorHref = workId ? `/studio/work/${workId}` : null;
  const mobileQuery = mobileView ? "&viewport=mobile" : "";
  const destinations: Record<WorkbenchPanel, string | null> = {
    work: editorHref ? `${editorHref}?panel=work${mobileView ? "&viewport=mobile" : ""}#work` : "/studio/work",
    source: editorHref ? `${editorHref}/source${mobileView ? "?viewport=mobile" : ""}` : null,
    create: editorHref ? `${editorHref}?panel=create${mobileQuery}#create` : null,
    results: editorHref ? `${editorHref}?panel=results${mobileQuery}#results` : null,
    preview: editorHref ? `${editorHref}/preview` : null,
    timeline: editorHref ? `${editorHref}/timeline` : null,
    mobile: editorHref ? `${editorHref}?viewport=mobile` : null,
  };

  return (
    <nav className="studio-stage-nav" aria-label="Storyboard workbench panels">
      <p className="studio-stage-nav-heading">Work</p>
      {labels.map(({ id, label }) => {
        const Icon = icons[id];
        const href = destinations[id];
        const className = cn(
          "studio-stage-nav-item",
          active === id && "studio-stage-nav-item-active",
          !href && "studio-stage-nav-item-disabled",
        );
        const content = (
          <>
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </>
        );

        return href && !(id === "source" && onSourceOpen) ? (
          <Link
            key={id}
            href={href}
            className={className}
            aria-current={active === id ? "page" : undefined}
          >
            {content}
          </Link>
        ) : id === "source" && onSourceOpen ? (
          <button key={id} type="button" onClick={onSourceOpen} className={className}>
            {content}
          </button>
        ) : (
          <span key={id} className={className} aria-disabled="true" title="Save your storyboard first to unlock this panel">
            {content}
          </span>
        );
      })}
    </nav>
  );
}
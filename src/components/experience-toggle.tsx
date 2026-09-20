"use client";

import Link from "next/link";
import { UNIVERSE_LABEL, ENTER_2_5D_LABEL, HOLOGRAPHIC_EXPERIENCE_LABEL } from "@/lib/experience/destinations";

export default function ExperienceToggle({
  universeHref,
  spatialHref,
  experienceHref,
  current,
}: {
  universeHref: string;
  /** /worlds/[id]/2.5d */
  spatialHref: string;
  experienceHref: string;
  current: "universe" | "spatial" | "experience";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">View</span>
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
        <Link
          href={universeHref}
          aria-current={current === "universe" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          data-experience-entry="universe"
          style={
            current === "universe"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          {UNIVERSE_LABEL}
        </Link>
        <Link
          href={spatialHref}
          aria-current={current === "spatial" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          data-experience-entry="2.5d"
          style={
            current === "spatial"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          {ENTER_2_5D_LABEL}
        </Link>
        <Link
          href={experienceHref}
          aria-current={current === "experience" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          data-experience-entry="holographic"
          style={
            current === "experience"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          {HOLOGRAPHIC_EXPERIENCE_LABEL}
        </Link>
      </div>
    </div>
  );
}

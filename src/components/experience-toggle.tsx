"use client";

import Link from "next/link";

export default function ExperienceToggle({
  universeHref,
  experienceHref,
  current,
}: {
  universeHref: string;
  experienceHref: string;
  current: "universe" | "experience";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">View</span>
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
        <Link
          href={universeHref}
          aria-current={current === "universe" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={
            current === "universe"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          Universe
        </Link>
        <Link
          href={experienceHref}
          aria-current={current === "experience" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={
            current === "experience"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          Experience
        </Link>
      </div>
    </div>
  );
}

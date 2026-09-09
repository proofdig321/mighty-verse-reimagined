"use client";

import Link from "next/link";

export default function ExperienceToggle({
  twoDHref,
  holographicHref,
  current,
}: {
  twoDHref: string;
  holographicHref: string;
  current: "2d" | "2.5d";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Experience</span>
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
        <Link
          href={twoDHref}
          aria-current={current === "2d" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={
            current === "2d"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          2D
        </Link>
        <Link
          href={holographicHref}
          aria-current={current === "2.5d" ? "page" : undefined}
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={
            current === "2.5d"
              ? { background: "var(--accent-mv)", color: "#000" }
              : { color: "var(--muted-foreground)" }
          }
        >
          2.5D
        </Link>
      </div>
    </div>
  );
}

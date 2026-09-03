"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import ArtworkFrame from "@/components/artwork-frame";

type UniverseItem = {
  master_id: string;
  title: string | null;
  attribution_roles: string[];
  projection_count: number;
};

type Props = { universes: UniverseItem[] };

export default function UniversesFilterClient({ universes }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? universes.filter((u) =>
        (u.title ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : universes;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Input
          placeholder="Search universes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-muted-foreground"
          defaultValue=""
        >
          <option value="">All Genres</option>
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="artifact-grid">
          {filtered.map((u) => (
            <Link key={u.master_id} href={`/worlds/${u.master_id}`} className="artifact-card group">
              <ArtworkFrame artworkUrl={null} alt={u.title ?? ""} aspectRatio="2/3" />
              <div className="artifact-copy">
                <p
                  className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity"
                  style={{ fontFamily: "var(--font-display, inherit)" }}
                >
                  {u.title ?? "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {u.attribution_roles.length > 0
                    ? u.attribution_roles.map((r) => r.replace(/-/g, " ")).join(", ")
                    : "Various Artists"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {u.projection_count} Moment{u.projection_count !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No universes yet.</p>
      )}
    </div>
  );
}

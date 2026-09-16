"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GallerySource } from "@/lib/assemble/gallery-source";
import { formatDuration } from "@/lib/media/timing";

export function GallerySourcePicker({
  sources,
  selectedId,
  onSelect,
  disabled = false,
  label = "Select from gallery",
}: {
  sources: GallerySource[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const visible = sources.filter((source) => {
    if (!query) return true;
    return `${source.title ?? ""} ${source.provider ?? ""} ${source.associated_title ?? ""}`
      .toLowerCase()
      .includes(query);
  });

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-gallery-picker="empty">
        No playable gallery media is available yet. Add media through intake, then return here.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-gallery-picker="live">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search gallery media"
          aria-label="Search gallery media"
          disabled={disabled}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2" data-gallery-source-list="">
        {visible.map((source) => {
          const selected = selectedId === source.asset_id;
          const duration = source.duration_ms != null ? formatDuration(source.duration_ms / 1000) : null;
          return (
            <li key={source.asset_id}>
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                className="h-auto w-full justify-start whitespace-normal px-3 py-3 text-left"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSelect(source.asset_id)}
              >
                <span className="block min-w-0">
                  <span className="block text-sm font-medium">{source.title ?? "Untitled media"}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {[source.provider, duration, source.associated_title ? `Bound to ${source.associated_title}` : "Unbound"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">No gallery media matches that search.</p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Music, FileText } from "lucide-react";
import MediaVisual from "@/components/media-visual";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
  storage_ref: string | null;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  work_title: string | null;
};

type Props = { items: MediaItem[] };

const TABS = ["All Media", "Videos", "Images", "Audio", "Documents"] as const;
type Tab = (typeof TABS)[number];

const TYPE_MAP: Record<Tab, string | null> = {
  "All Media": null,
  Videos: "video",
  Images: "image",
  Audio: "audio",
  Documents: "document",
};

function AssetPreview({ item }: { item: MediaItem }) {
  const isVideo = item.asset_type?.toLowerCase().includes("video");
  const isAudio = item.asset_type?.toLowerCase().includes("audio");
  const isDoc = item.asset_type?.toLowerCase().includes("document");

  if (isVideo) {
    return (
      <div className="relative">
        <MediaVisual
          playbackId={item.storage_ref ?? undefined}
          title={item.title ?? item.work_title ?? ""}
          aspectRatio="16/9"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/50">
            <span className="text-white text-xs ml-0.5">▶</span>
          </div>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div
        className="w-full bg-card border border-border rounded-md flex items-center justify-center"
        style={{ aspectRatio: "16/9" }}
      >
        <div className="text-center space-y-1">
          <Music size={20} strokeWidth={1.5} className="mx-auto text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Audio</p>
        </div>
      </div>
    );
  }

  if (isDoc) {
    return (
      <div
        className="w-full bg-card border border-border rounded-md flex items-center justify-center"
        style={{ aspectRatio: "16/9" }}
      >
        <div className="text-center space-y-1">
          <FileText size={20} strokeWidth={1.5} className="mx-auto text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Document</p>
        </div>
      </div>
    );
  }

  return (
    <MediaVisual
      playbackId={item.storage_ref ?? undefined}
      title={item.title ?? item.work_title ?? ""}
      aspectRatio="16/9"
    />
  );
}

export default function GalleryFilterClient({ items }: Props) {
  const [tab, setTab] = useState<Tab>("All Media");

  const typeFilter = TYPE_MAP[tab];
  const filtered = typeFilter
    ? items.filter((i) => i.asset_type?.toLowerCase().includes(typeFilter))
    : items;

  return (
    <div>
      {/* Header band */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              The full catalogue
            </p>
            <h1
              className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Media Gallery
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Images, videos, audio and documents from across the universes.
            </p>
          </div>
          {/* Filter tabs inline on the right */}
          <div className="flex items-center gap-0.5 shrink-0 overflow-x-auto scrollbar-hidden">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  tab === t
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {tab === "All Media" ? "" : tab.toLowerCase() + " "}assets yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <div key={item.asset_id} className="space-y-2">
                <AssetPreview item={item} />
                <div className="space-y-0.5 px-0.5">
                  <p className="text-xs text-foreground truncate">
                    {item.title ?? item.work_title ?? (
                      <span className="italic text-muted-foreground">Untitled</span>
                    )}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    {item.asset_type ?? "unknown"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

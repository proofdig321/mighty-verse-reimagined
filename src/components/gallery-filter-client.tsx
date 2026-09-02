"use client";

import { useState } from "react";
import ArtworkFrame from "@/components/artwork-frame";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
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

export default function GalleryFilterClient({ items }: Props) {
  const [tab, setTab] = useState<Tab>("All Media");

  const typeFilter = TYPE_MAP[tab];
  const filtered = typeFilter
    ? items.filter((i) => i.asset_type?.toLowerCase().includes(typeFilter))
    : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={tab === t ? { borderBottomColor: "var(--accent-mv)" } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.asset_id} className="space-y-1.5">
              <div className="relative">
                <ArtworkFrame artworkUrl={null} alt={item.title ?? ""} aspectRatio="16/9" />
                {item.asset_type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60">
                      <span className="text-white text-xs ml-0.5">▶</span>
                    </div>
                  </div>
                )}
                {item.asset_type === "audio" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-muted-foreground text-xs">♪</span>
                  </div>
                )}
                {item.asset_type === "document" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-muted-foreground text-lg">📄</span>
                  </div>
                )}
              </div>
              {item.title && (
                <p className="text-xs text-muted-foreground truncate">{item.title}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Media coming soon.</p>
      )}
    </div>
  );
}

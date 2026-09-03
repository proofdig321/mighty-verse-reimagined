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

function RightsState({ rights_holder_ref, rights_basis }: { rights_holder_ref: string | null; rights_basis: string | null }) {
  if (rights_holder_ref && rights_basis) {
    return <span className="text-[10px] text-green-400">Rights on file</span>;
  }
  return <span className="text-[10px] text-muted-foreground/40 italic">void</span>;
}

function AssetPreview({ item }: { item: MediaItem }) {
  const isVideo = item.asset_type?.toLowerCase().includes("video");
  const isAudio = item.asset_type?.toLowerCase().includes("audio");
  const isDoc   = item.asset_type?.toLowerCase().includes("document");

  // Video: MediaVisual resolves storage_ref (Livepeer asset ID) → poster via /api/livepeer/playback/
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

  // Audio: intentional audio placeholder
  if (isAudio) {
    return (
      <div className="w-full bg-card border border-border rounded-md flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="text-center space-y-1">
          <Music size={20} strokeWidth={1.5} className="mx-auto text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Audio</p>
        </div>
      </div>
    );
  }

  if (isDoc) {
    return (
      <div className="w-full bg-card border border-border rounded-md flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="text-center space-y-1">
          <FileText size={20} strokeWidth={1.5} className="mx-auto text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Document</p>
        </div>
      </div>
    );
  }

  // Image or unknown: MediaVisual handles gracefully (shows title fallback if no poster)
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
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={tab === t ? { borderBottomColor: "var(--accent-mv)" } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {tab === "All Media" ? "" : tab.toLowerCase() + " "}assets in the operational scope.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.asset_id} className="space-y-2">
              <AssetPreview item={item} />
              <div className="space-y-0.5 px-0.5">
                <p className="text-xs text-foreground truncate">
                  {item.title ?? item.work_title ?? <span className="italic text-muted-foreground">void</span>}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  {item.asset_type ?? "unknown"}
                </p>
                <RightsState rights_holder_ref={item.rights_holder_ref} rights_basis={item.rights_basis} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Music, FileText, Film } from "lucide-react";
import MediaVisual from "@/components/media-visual";
import { PublicHero } from "@/components/public-hero";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type MediaItem = {
  asset_id: string;
  asset_type: string | null;
  title: string | null;
  storage_ref: string | null;
  provider: string | null;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  work_title: string | null;
};

type Props = { items: MediaItem[] };

const TABS = ["All", "Video", "Audio", "Image", "Document"] as const;
type Tab = (typeof TABS)[number];

function matchesTab(item: MediaItem, tab: Tab): boolean {
  if (tab === "All") return true;
  const t = item.asset_type?.toLowerCase() ?? "";
  if (tab === "Video") return t.includes("video");
  if (tab === "Audio") return t.includes("audio");
  if (tab === "Image") return t.includes("image");
  if (tab === "Document") return t.includes("document");
  return false;
}

function AssetCard({ item }: { item: MediaItem }) {
  const t = item.asset_type?.toLowerCase() ?? "";
  const isVideo = t.includes("video");
  const isAudio = t.includes("audio");
  const isDoc = t.includes("document");

  const visual = isVideo ? (
    <MediaVisual
      playbackId={item.storage_ref ?? undefined}
      provider={item.provider}
      title={item.title ?? item.work_title ?? ""}
      aspectRatio="16/9"
    />
  ) : (
    <div
      className="w-full rounded-lg border border-border bg-card/60 flex items-center justify-center"
      style={{ aspectRatio: "16/9" }}
    >
      {isAudio ? <Music size={18} className="text-muted-foreground/50" /> :
       isDoc ? <FileText size={18} className="text-muted-foreground/50" /> :
       <Film size={18} className="text-muted-foreground/50" />}
    </div>
  );

  return (
    <div className="group space-y-2">
      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10 transition-shadow group-hover:ring-foreground/20">
        {visual}
      </div>
      <div className="space-y-1 px-0.5">
        <p className="text-xs font-medium text-foreground truncate leading-snug">
          {item.title ?? item.work_title ?? <span className="italic text-muted-foreground">Untitled</span>}
        </p>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-4 text-[9px] px-1.5 uppercase tracking-wider">
            {item.asset_type ?? "unknown"}
          </Badge>
          {item.rights_holder_ref && (
            <Badge variant="secondary" className="h-4 text-[9px] px-1.5">Rights</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GalleryFilterClient({ items }: Props) {
  const [tab, setTab] = useState<Tab>("All");

  const filtered = items.filter((i) => matchesTab(i, tab));

  const counts = Object.fromEntries(
    TABS.map((t) => [t, items.filter((i) => matchesTab(i, t)).length])
  ) as Record<Tab, number>;

  return (
    <div>
      <PublicHero
        eyebrow="Media"
        title="Gallery"
        description="Public media assets across all Universes. Selecting media here does not imply Universe ownership."
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t} value={t} className="gap-1.5">
                  {t}
                  {counts[t] > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">{counts[t]}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground shrink-0">
            {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-16 text-center">
            <Film size={24} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No {tab === "All" ? "" : tab.toLowerCase() + " "}assets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Media appears here once it is bound to a public projection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((item) => (
              <AssetCard key={item.asset_id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

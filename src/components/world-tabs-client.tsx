"use client";

import { useState } from "react";
import Link from "next/link";
import MomentCard from "@/components/moment-card";
import ArtworkFrame from "@/components/artwork-frame";

type MuralRow = { master_id: string; title: string | null; projection_id: string | null };
type MomentRow = { master_id: string; title: string | null; scene_projection_id: string | null };

type Props = {
  masterId: string;
  description: string | null;
  murals: MuralRow[];
  moments: MomentRow[];
  attributionRoles: string[];
};

const TABS = ["Overview", "Scenes", "Moments", "Participants", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function WorldTabsClient({ masterId, description, murals, moments, attributionRoles }: Props) {
  const [active, setActive] = useState<Tab>("Overview");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              active === tab
                ? "text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={active === tab ? { borderBottomColor: "var(--accent-mv)" } : undefined}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "Overview" && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">About this Universe</p>
              {description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description yet.</p>
              )}
            </div>
            {attributionRoles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributionRoles.map((r) => (
                  <span key={r} className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
                    {r.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
          {murals[0] && (
            <div className="space-y-2">
              <Link href={`/worlds/${murals[0].master_id}`} className="block group">
                <div className="relative">
                  <ArtworkFrame artworkUrl={null} alt={murals[0].title ?? "Mural"} aspectRatio="16/9" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "var(--accent-mv)" }}
                    >
                      <span className="text-white text-lg ml-1">▶</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Watch Mural Trailer</p>
              </Link>
            </div>
          )}
        </div>
      )}

      {active === "Scenes" && (
        <div className="space-y-2">
          {murals.length > 0 ? (
            murals.map((m) => (
              <MomentCard
                key={m.master_id}
                href={`/worlds/${m.master_id}`}
                title={m.title}
                typeLabel="Mural"
                hasMedia={!!m.projection_id}
                collectible={false}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No scenes yet.</p>
          )}
        </div>
      )}

      {active === "Moments" && (
        <div className="space-y-2">
          {moments.length > 0 ? (
            moments.map((m) => (
              <MomentCard
                key={m.master_id}
                href={m.scene_projection_id ? `/moments/${m.scene_projection_id}` : `/creative-moments/${m.master_id}`}
                title={m.title}
                typeLabel="Creative Moment"
                hasMedia={!!m.scene_projection_id}
                collectible={false}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No moments yet.</p>
          )}
        </div>
      )}

      {active === "Participants" && (
        <p className="text-sm text-muted-foreground">No participants yet.</p>
      )}

      {active === "Activity" && (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
    </div>
  );
}

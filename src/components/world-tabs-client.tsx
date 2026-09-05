"use client";

import { useState } from "react";
import Link from "next/link";
import MomentCard from "@/components/moment-card";
import ArtworkFrame from "@/components/artwork-frame";

type MuralRow = { master_id: string; title: string | null; projection_id: string | null };
type MomentRow = { master_id: string; title: string | null; projection_id: string | null };

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
    <div className="space-y-8">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto scrollbar-hidden">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={[
              "shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              active === tab
                ? "text-foreground border-b-[var(--accent-mv)]"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
            style={active === tab ? { borderBottomColor: "var(--accent-mv)" } : undefined}
          >
            {tab}
          </button>
        ))}
      </div>

      {active === "Overview" && (
        <div className="grid md:grid-cols-[1fr_auto] gap-10 items-start">
          <div className="space-y-5 max-w-2xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                About this Universe
              </p>
              {description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description yet.</p>
              )}
            </div>
            {attributionRoles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attributionRoles.map((r) => (
                  <span
                    key={r}
                    className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground capitalize"
                  >
                    {r.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {murals[0] && (
            <div className="w-full md:w-64 shrink-0 space-y-2">
              <Link href={`/worlds/${murals[0].master_id}`} className="block group">
                <div className="relative overflow-hidden rounded-lg">
                  <ArtworkFrame artworkUrl={null} alt={murals[0].title ?? "Mural"} aspectRatio="16/9" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: "var(--accent-mv)" }}
                    >
                      <span className="text-white text-lg ml-1">▶</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 group-hover:text-foreground transition-colors">
                  {murals[0].title ?? "Watch Mural"}
                </p>
              </Link>
            </div>
          )}
        </div>
      )}

      {active === "Scenes" && (
        <div className="space-y-2">
          {murals.length > 0 ? (
            <>
              {murals.map((m) => (
                <MomentCard
                  key={m.master_id}
                  href={`/worlds/${m.master_id}`}
                  title={m.title}
                  typeLabel="Mural"
                  hasMedia={!!m.projection_id}
                  collectible={false}
                />
              ))}
              <div className="pt-3">
                <Link
                  href={`/worlds/${masterId}/scenes`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Scene Deck →
                </Link>
              </div>
            </>
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
                href={m.projection_id ? `/moments/${m.projection_id}` : `/creative-moments/${m.master_id}`}
                title={m.title}
                typeLabel="Creative Moment"
                hasMedia={false}
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

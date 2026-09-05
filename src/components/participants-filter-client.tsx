"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type ParticipantItem = {
  participant_id: string;
  display_name: string | null;
  role: string | null;
};

type Props = { participants: ParticipantItem[] };

const TABS = ["All", "Artists", "Producers", "Animators", "Organizations"] as const;
type Tab = (typeof TABS)[number];

const ROLE_MAP: Record<Tab, string | null> = {
  All: null,
  Artists: "artist",
  Producers: "producer",
  Animators: "animator",
  Organizations: "organization",
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function ParticipantsFilterClient({ participants }: Props) {
  const [tab, setTab] = useState<Tab>("All");

  const roleFilter = ROLE_MAP[tab];
  const filtered = roleFilter
    ? participants.filter((p) => p.role?.toLowerCase().includes(roleFilter))
    : participants;

  return (
    <div>
      {/* Header band */}
      <div className="border-b border-border bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-mv">
              The people building the universes
            </p>
            <h1
              className="mt-1.5 text-3xl font-semibold text-foreground md:text-4xl"
              style={{ fontFamily: "var(--font-display, inherit)" }}
            >
              Creators & Participants
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The people building the universes.
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
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filtered.map((p) => (
              <div key={p.participant_id} className="flex flex-col items-center gap-3 text-center">
                <Avatar className="w-16 h-16">
                  <AvatarFallback
                    className="text-base font-semibold"
                    style={{ background: "color-mix(in oklch, var(--accent-mv) 25%, var(--card))", color: "var(--accent-mv)" }}
                  >
                    {initials(p.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[9rem]">
                    {p.display_name ?? `${p.participant_id.slice(0, 8)}…`}
                  </p>
                  {p.role && (
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {p.role.replace(/-/g, " ")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 px-8 py-12 text-center">
            <p className="text-sm text-muted-foreground">No participants yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

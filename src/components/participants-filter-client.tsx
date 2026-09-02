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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filtered.map((p) => (
            <div key={p.participant_id} className="flex flex-col items-center gap-2 text-center">
              <Avatar size="lg">
                <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground truncate max-w-[8rem]">
                  {p.display_name ?? `${p.participant_id.slice(0, 8)}…`}
                </p>
                {p.role && (
                  <p className="text-xs text-muted-foreground capitalize">{p.role.replace(/-/g, " ")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No participants yet.</p>
      )}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import {
  Clapperboard,
  Film,
  Globe,
  LayoutDashboard,
  Layers,
  MonitorPlay,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceJourney } from "@/components/assemble/workspace-journey";

export default function AuthorityShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brandTitle="Mighty Verse"
      brandKicker="Authority Console"
      headerEyebrow="Authority"
      headerTitle="Create → Curate → Studio → Experience"
      footer={
        <div className="space-y-3 border-t border-border px-3 py-4">
          <WorkspaceJourney compact />
        </div>
      }
      groups={[
        {
          label: "Workspace",
          items: [
            { href: "/authority", label: "Dashboard", icon: LayoutDashboard, exact: true },
            { href: "/authority/create", label: "Create Work", icon: Plus },
            { href: "/authority/curate", label: "Curate", icon: Wand2 },
            { href: "/studio", label: "Creative Studio", icon: MonitorPlay },
          ],
        },
        {
          label: "Canonical",
          items: [
            { href: "/authority/universes", label: "Universes", icon: Globe, match: "exact" },
            { href: "/authority/murals", label: "Murals", icon: Layers },
            { href: "/authority/scenes", label: "Scenes", icon: Clapperboard },
            { href: "/authority/creative-moments", label: "Creative Moments", icon: Sparkles },
          ],
        },
        {
          label: "Media",
          items: [
            { href: "/authority/media", label: "Gallery", icon: Film },
            { href: "/authority/media/intake", label: "Add Media", icon: Upload },
          ],
        },
        {
          label: "Rights",
          items: [
            { href: "/authority/participants", label: "Participants", icon: Users },
            { href: "/authority/proof-of-rights", label: "Proof of Rights", icon: ShieldCheck },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

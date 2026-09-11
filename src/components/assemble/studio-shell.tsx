"use client";

import type { ReactNode } from "react";
import { Clapperboard, LayoutDashboard, MonitorPlay, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brandTitle="Mighty Verse"
      brandKicker="Creative Studio"
      headerEyebrow="Creative Studio"
      headerTitle="Imagine → Story → Visualise → Generate"
      groups={[
        {
          label: "Studio",
          items: [
            { href: "/studio", label: "Studio home", icon: MonitorPlay, exact: true },
            { href: "/studio/work", label: "New creative work", icon: Plus },
            { href: "/authority", label: "Dashboard", icon: LayoutDashboard },
            { href: "/scenes", label: "Scene Deck", icon: Clapperboard },
            { href: "/editor", label: "Experience Editor", icon: Sparkles },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

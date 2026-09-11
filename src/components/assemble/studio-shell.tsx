"use client";

import type { ReactNode } from "react";
import { Clapperboard, Globe, Home, Images, LayoutDashboard, MonitorPlay, Plus, Sparkles } from "lucide-react";
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
            { href: "/editor", label: "Timeline", icon: Sparkles },
          ],
        },
        {
          label: "Discover",
          items: [
            { href: "/", label: "Home", icon: Home, exact: true, surface: "home" },
            { href: "/universes", label: "Universes", icon: Globe, surface: "universes" },
            { href: "/gallery", label: "Gallery", icon: Images, surface: "gallery" },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

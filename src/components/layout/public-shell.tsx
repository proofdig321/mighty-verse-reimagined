"use client";

import type { ReactNode } from "react";
import {
  Clapperboard,
  Film,
  Globe,
  Home,
  Images,
  Layers,
  MonitorPlay,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brandTitle="Mighty Verse"
      brandKicker="Discover"
      headerEyebrow="Public"
      headerTitle="Discover → Reveal → Assemble → Experience"
      groups={[
        {
          label: "Discover",
          items: [
            { href: "/", label: "Home", icon: Home, exact: true, surface: "home" },
            { href: "/universes", label: "Universes", icon: Globe, surface: "universes" },
            { href: "/murals", label: "Murals", icon: Layers, surface: "murals" },
            { href: "/scenes", label: "Scenes", icon: Clapperboard, surface: "scenes" },
            { href: "/moments", label: "Creative Moments", icon: Sparkles, surface: "moments" },
            { href: "/gallery", label: "Gallery", icon: Images, surface: "gallery" },
          ],
        },
        {
          label: "Create",
          items: [
            { href: "/studio", label: "Creative Studio", icon: MonitorPlay, surface: "studio" },
            { href: "/editor", label: "Timeline", icon: Film, surface: "editor" },
            { href: "/authority", label: "Dashboard", icon: Wand2, surface: "dashboard" },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

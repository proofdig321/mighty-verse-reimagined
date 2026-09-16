"use client";

import type { ReactNode } from "react";
import { LayoutDashboard, MonitorPlay, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { studioInteractionLabel } from "@/lib/assemble/studio-interaction";

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      brandTitle="Mighty Verse"
      brandKicker="Creative Studio"
      headerEyebrow="Creative Studio"
      headerTitle={studioInteractionLabel()}
      groups={[
        {
          label: "Studio",
          items: [
            { href: "/studio", label: "Studio home", icon: MonitorPlay, exact: true, surface: "studio" },
            { href: "/studio/work", label: "New creative work", icon: Plus },
            { href: "/authority", label: "Dashboard", icon: LayoutDashboard },
          ],
        },
      ]}
    >
      {children}
    </AppShell>
  );
}

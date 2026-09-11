"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, LayoutDashboard, MonitorPlay, PanelLeft, Plus, Sparkles } from "lucide-react";
import { ThemePresetControl } from "@/components/theme/theme-preset-control";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STUDIO_LINKS = [
  { href: "/studio", label: "Studio home", icon: MonitorPlay, exact: true },
  { href: "/studio/work", label: "New creative work", icon: Plus, exact: false },
  { href: "/authority", label: "Dashboard", icon: LayoutDashboard, exact: false },
  { href: "/scenes", label: "Scene Deck", icon: Clapperboard, exact: false },
  { href: "/universes", label: "Experience", icon: Sparkles, exact: false },
] as const;

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="multiverse-page flex min-h-screen flex-col bg-background lg:flex-row">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
            <p className="text-sm font-semibold text-foreground">Mighty Verse</p>
          </div>
          <ThemePresetControl />
        </div>
        <nav aria-label="Studio" className="mt-3 flex flex-wrap gap-2">
          {STUDIO_LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={`mobile-${link.href}`}
                href={link.href}
                className={cn(
                  "rounded-md border border-border px-2 py-1 text-[11px] font-medium",
                  active ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border lg:flex",
          collapsed ? "w-16" : "w-64",
        )}
        style={{ background: "var(--sidebar)" }}
        data-studio-sidebar={collapsed ? "collapsed" : "expanded"}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-4">
          {collapsed ? (
            <span className="mx-auto text-xs font-bold text-foreground">MV</span>
          ) : (
            <div>
              <p className="text-xs font-bold tracking-tight text-foreground">Mighty Verse</p>
              <p className="text-[10px] text-muted-foreground">Creative Studio</p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((value) => !value)}
          >
            <PanelLeft size={14} />
          </Button>
        </div>
        <nav aria-label="Studio" className="flex flex-1 flex-col gap-1 p-2">
          {STUDIO_LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                  active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  collapsed && "justify-center",
                )}
              >
                <Icon size={15} />
                {collapsed ? null : link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:flex">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
            <p className="text-sm text-foreground">Imagine → Story → Visualise → Generate</p>
          </div>
          <ThemePresetControl />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

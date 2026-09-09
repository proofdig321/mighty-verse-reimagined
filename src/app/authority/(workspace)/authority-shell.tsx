"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Clapperboard, Film, Globe, LayoutDashboard, Layers,
  Menu, MonitorPlay, Plus, ShieldCheck, Sparkles, Upload, Users, X, Wand2,
} from "lucide-react";
import { WorkspaceJourney } from "@/components/assemble/workspace-journey";

const NAV_GROUPS = [
  {
    label: "Workspace",
    links: [
      { label: "Dashboard",  href: "/authority",        icon: LayoutDashboard, match: "prefix" as const },
      { label: "Create Work", href: "/authority/create", icon: Plus, match: "prefix" as const },
      { label: "Curate",     href: "/authority/curate", icon: Wand2, match: "prefix" as const },
      { label: "Creative Studio", href: "/authority/universes", icon: MonitorPlay, match: "prefix" as const },
    ],
  },
  {
    label: "Canonical",
    links: [
      { label: "Universes",        href: "/authority/universes",        icon: Globe, match: "exact" as const },
      { label: "Murals",           href: "/authority/murals",           icon: Layers, match: "prefix" as const },
      { label: "Scenes",           href: "/authority/scenes",           icon: Clapperboard, match: "prefix" as const },
      { label: "Creative Moments", href: "/authority/creative-moments", icon: Sparkles, match: "prefix" as const },
    ],
  },
  {
    label: "Media",
    links: [
      { label: "Gallery",   href: "/authority/media",        icon: Film, match: "prefix" as const },
      { label: "Add Media", href: "/authority/media/intake", icon: Upload, match: "prefix" as const },
    ],
  },
  {
    label: "Rights",
    links: [
      { label: "Participants",    href: "/authority/participants",    icon: Users, match: "prefix" as const },
      { label: "Proof of Rights", href: "/authority/proof-of-rights", icon: ShieldCheck, match: "prefix" as const },
    ],
  },
] as const;

export default function AuthorityShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();

  function isActive(href: string, match: "prefix" | "exact" = "prefix") {
    if (href === "/authority") return pathname === "/authority";
    if (match === "exact") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="multiverse-page min-h-screen overflow-x-hidden bg-background flex flex-col lg:flex-row">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "var(--accent-mv)" }}
            >
              MV
            </div>
            <span className="text-sm font-semibold text-foreground">Authority</span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          ${mobileNav ? "flex" : "hidden"}
          fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-border
          lg:flex lg:static lg:inset-auto lg:min-h-screen lg:shrink-0 scrollbar-hidden
        `}
        style={{ background: "var(--sidebar)" }}
      >
        {/* Sidebar header */}
        <div className="flex items-start justify-between px-5 pt-6 pb-5 border-b border-border">
          <Link href="/authority" className="group" onClick={() => setMobileNav(false)}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "var(--accent-mv)" }}
              >
                MV
              </div>
              <div>
                <p className="text-xs font-bold tracking-tight text-foreground leading-none">MIGHTY VERSE</p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">AUTHORITY CONSOLE</p>
              </div>
            </div>
          </Link>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Authority" className="flex-1 px-3 py-5 overflow-y-auto space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/50">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.links.map(({ label, href, icon: Icon, match }) => {
                  const active = isActive(href, match);
                  return (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setMobileNav(false)}
                      className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-accent text-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-accent-mv" />
                      )}
                      <Icon
                        size={15}
                        strokeWidth={1.5}
                        className={active ? "text-accent-mv" : "text-muted-foreground/60 group-hover:text-muted-foreground"}
                      />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-2 pb-2">
          <WorkspaceJourney compact />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Public site / Experience
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 flex flex-col">
        <main className="flex-1 w-full px-4 pt-8 pb-16 sm:px-6 lg:px-10">
          <div className="dashboard-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

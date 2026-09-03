"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Film, LayoutDashboard, Menu, ShieldCheck, Users, X } from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Workspace",
    links: [
      { label: "Dashboard",       href: "/authority",                icon: LayoutDashboard },
      { label: "Media Gallery",   href: "/authority/media",          icon: Film },
      { label: "Participants",    href: "/authority/participants",    icon: Users },
      { label: "Proof of Rights", href: "/authority/proof-of-rights", icon: ShieldCheck },
    ],
  },
] as const;

export default function AuthorityShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/authority") return pathname === "/authority";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation" className="text-muted-foreground hover:text-foreground mr-2">
            <Menu size={16} />
          </button>
          <span className="font-semibold text-foreground">Mighty Verse</span>
          <span className="opacity-30">/</span>
          <span>Authority</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${mobileNav ? "flex" : "hidden"}
        fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-border bg-card
        lg:flex lg:static lg:inset-auto lg:min-h-screen lg:shrink-0
      `}>
        {/* Sidebar header */}
        <div className="flex items-start justify-between px-5 pt-6 pb-5 border-b border-border">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-foreground">Mighty Verse</p>
            <p className="mt-0.5 text-[10px] tracking-widest uppercase text-muted-foreground">Authority Console</p>
          </div>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.links.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <a
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
                      <Icon size={15} strokeWidth={1.5} className={active ? "text-accent-mv" : "text-muted-foreground/60 group-hover:text-muted-foreground"} />
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 flex flex-col">
        <main className="flex-1 w-full px-4 pt-8 pb-16 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

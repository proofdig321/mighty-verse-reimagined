"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, Archive, BarChart3, Database, LayoutDashboard, Menu, ShieldCheck, Upload, Users, X } from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Workspace",
    links: [
      { label: "Dashboard", href: "/authority", icon: LayoutDashboard },
      { label: "Content", href: "/authority", icon: Archive },
      { label: "Production", href: "/authority", icon: Activity },
      { label: "Publishing", href: "/authority", icon: BarChart3 },
      { label: "Rights", href: "/authority", icon: ShieldCheck },
    ],
  },
  {
    label: "Tools",
    links: [
      { label: "Media intake", href: "/authority/media", icon: Upload },
      { label: "Technical details", href: "/authority", icon: Database },
    ],
  },
] as const;

type Props = {
  children: React.ReactNode;
  scopeType?: string;
  pageLabel?: string;
};

export default function AuthorityShell({ children, scopeType, pageLabel }: Props) {
  const [mobileNav, setMobileNav] = useState(false);
  const pathname = usePathname();

  // Determine which top-level route is active for sidebar highlighting
  const isMedia = pathname === "/authority/media";
  const isParticipants = pathname === "/authority/participants";
  const isWorkDetail = !isMedia && !isParticipants && pathname !== "/authority" && pathname.startsWith("/authority/");

  function linkActive(href: string, label: string) {
    if (href === "/authority/media") return isMedia;
    if (href === "/authority/participants") return isParticipants;
    // Dashboard-level links: active when on /authority or a work detail
    return !isMedia && !isParticipants;
  }

  return (
    <div className="min-h-screen bg-muted/30 pt-12 lg:flex lg:pt-0">
      {/* Top bar */}
      <div className="fixed inset-x-0 top-0 z-10 border-b border-foreground/10 bg-background px-4 py-2 text-foreground shadow-sm lg:pl-72">
        <div className="mx-auto flex max-w-[1500px] items-baseline gap-3 text-sm">
          <span className="font-semibold">Mighty Verse</span>
          <span className="text-muted-foreground">Authority</span>
          {pageLabel && <span className="text-muted-foreground">{pageLabel}</span>}
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`${mobileNav ? "block" : "hidden"} fixed inset-y-0 left-0 z-20 w-64 border-r border-border bg-card p-5 lg:static lg:block lg:min-h-screen`}
      >
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">Mighty Verse</p>
            <p className="mt-1 text-xs text-muted-foreground">Authority Console</p>
          </div>
          <button className="lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>

        <nav className="space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.links.map(({ label, href, icon: Icon }) => {
                  const active = linkActive(href, label);
                  return (
                    <a
                      key={label}
                      href={href}
                      onClick={() => setMobileNav(false)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs ${
                        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {scopeType && (
          <div className="mt-10 border-t border-border pt-4">
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <Users size={14} />
              {scopeType} scope
            </div>
          </div>
        )}
      </aside>

      {/* Main content — hamburger + children */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile hamburger row */}
        <div className="flex items-center gap-3 px-4 pt-4 lg:hidden">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
        </div>
        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-8 p-4 sm:p-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

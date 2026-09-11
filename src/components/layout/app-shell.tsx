"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Menu, PanelLeft, Search, X } from "lucide-react";
import { ThemePresetControl } from "@/components/theme/theme-preset-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  match?: "prefix" | "exact";
  surface?: string;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

const COLLAPSE_KEY = "mv-shell-collapsed";

export function AppShell({
  children,
  groups,
  brandTitle,
  brandKicker,
  headerEyebrow,
  headerTitle,
  footer,
}: {
  children: ReactNode;
  groups: AppNavGroup[];
  brandTitle: string;
  brandKicker: string;
  headerEyebrow?: string;
  headerTitle?: string;
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const fullBleed = pathname.includes("/holographic");
  const flush = pathname.startsWith("/editor");
  const navItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function goToSearch(event: FormEvent) {
    event.preventDefault();
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = navItems.find((item) => item.label.toLowerCase().includes(needle) || item.href.toLowerCase().includes(needle));
    if (match) {
      router.push(match.href);
      setQuery("");
      setMobileNav(false);
    }
  }

  function isActive(item: AppNavItem) {
    const match = item.match ?? (item.exact ? "exact" : "prefix");
    if (item.href === "/" || match === "exact") return pathname === item.href;
    if (item.href === "/authority") return pathname === "/authority" || pathname.startsWith("/authority/");
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const nav = (
    <nav aria-label={brandKicker} className="flex flex-1 flex-col gap-5 overflow-y-auto p-2">
      {groups.map((group, index) => (
        <div key={group.label}>
          {index > 0 ? <Separator className="mb-4 opacity-60" /> : null}
          {collapsed ? null : (
            <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/50">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-product-nav={item.surface}
                  onClick={() => setMobileNav(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    collapsed && "justify-center",
                  )}
                >
                  <Icon size={15} />
                  {collapsed ? null : item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  if (fullBleed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-md">
          <Link href="/" className="text-sm font-semibold">
            {brandTitle}
          </Link>
          <ThemePresetControl />
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="multiverse-page flex min-h-screen flex-col bg-background lg:flex-row">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)} className="text-muted-foreground">
            <Menu size={18} />
          </button>
          <div>
            <p className="text-sm font-semibold">{brandTitle}</p>
          </div>
          <ThemePresetControl />
        </div>
      </header>

      {mobileNav ? (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileNav(false)}>
          <aside
            className="flex h-full w-64 flex-col border-r border-border"
            style={{ background: "var(--sidebar)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="text-xs font-bold">{brandTitle}</p>
              <button type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)}>
                <X size={15} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border lg:flex",
          collapsed ? "w-16" : "w-64",
        )}
        style={{ background: "var(--sidebar)" }}
        data-app-sidebar={collapsed ? "collapsed" : "expanded"}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-4">
          {collapsed ? (
            <span className="mx-auto text-xs font-bold">MV</span>
          ) : (
            <div>
              <p className="text-xs font-bold tracking-tight">{brandTitle}</p>
              <p className="text-[10px] text-muted-foreground">{brandKicker}</p>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed}>
            <PanelLeft size={14} />
          </Button>
        </div>
        {nav}
        {collapsed ? null : footer}
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col", flush && "h-screen min-h-0")}>
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md lg:flex">
          <div className="min-w-0">
            {headerEyebrow ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{headerEyebrow}</p>
            ) : null}
            {headerTitle ? <p className="truncate text-sm text-foreground">{headerTitle}</p> : null}
          </div>
          <form onSubmit={goToSearch} className="relative hidden min-w-0 max-w-sm flex-1 md:block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search surfaces…"
              aria-label="Search surfaces"
              className="pl-8"
            />
          </form>
          <ThemePresetControl />
        </header>
        <main className={cn("flex-1", flush ? "flex min-h-0 flex-col overflow-hidden p-0" : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6")}>{children}</main>
      </div>
    </div>
  );
}

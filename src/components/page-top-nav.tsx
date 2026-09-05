"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/universes", label: "Universes" },
  { href: "/moments", label: "Moments" },
  { href: "/murals", label: "Murals" },
  { href: "/scenes", label: "Scenes" },
  { href: "/authority/public", label: "Authority" },
  { href: "/about", label: "About" },
];

type Props = { activePath?: string };

export default function PageTopNav({ activePath = "" }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border backdrop-blur-md bg-background/90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group" onClick={() => setMobileOpen(false)}>
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white transition-opacity group-hover:opacity-85"
              style={{ background: "var(--accent-mv)" }}
            >
              MV
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground hidden sm:block">
              Mighty Verse
            </span>
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map((link) => {
              const isActive = activePath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "shrink-0 px-3 py-1.5 text-sm transition-colors rounded-md",
                    isActive
                      ? "text-foreground font-semibold bg-accent/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/auth/sign-in"
              className="hidden sm:block px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "var(--accent-mv)" }}
            >
              Connect
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 inset-x-0 border-b border-border shadow-xl"
            style={{ background: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col px-4 py-3 gap-0.5">
              {NAV_LINKS.map((link) => {
                const isActive = activePath === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "px-3 py-2.5 text-sm rounded-md transition-colors",
                      isActive
                        ? "text-foreground font-semibold bg-accent/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-2 pb-1 border-t border-border mt-1">
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center px-3 py-2 rounded-md text-sm font-semibold text-white"
                  style={{ background: "var(--accent-mv)" }}
                >
                  Connect Wallet
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

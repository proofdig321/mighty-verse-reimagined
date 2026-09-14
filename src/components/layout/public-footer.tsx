import Link from "next/link";
import { AUDIENCE_HELP_HREF, PUBLIC_PRODUCT_NAV } from "@/lib/product-nav";

const FOOTER_SECONDARY = [
  { href: AUDIENCE_HELP_HREF, label: "Help" },
  { href: "/about", label: "About" },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card/30" data-public-footer="site">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">Mighty Verse</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Canonical home for Golden Shovel culture. Discover Universes, play Murals, and enter Experience.
            External platforms remain projections of this work.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {PUBLIC_PRODUCT_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-footer-nav={link.surface}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {FOOTER_SECONDARY.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © 2026 Golden Shovel · Mighty Verse. Canonical authority is not transferred by playback.
        </p>
      </div>
    </footer>
  );
}

import Link from "next/link";

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
  return (
    <div className="sticky top-0 z-10 border-b border-border backdrop-blur-sm bg-background/80">
      <div className="mx-auto max-w-5xl px-6 h-12 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = activePath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "px-3 py-1.5 text-sm transition-colors border-b-2",
                  isActive
                    ? "text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
                style={isActive ? { borderBottomColor: "var(--accent-mv)" } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <button
            aria-label="Search"
            className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none"
          >
            ⌕
          </button>
          <Link
            href="/auth/sign-in"
            className="px-3 py-1 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-mv)" }}
          >
            Connect Wallet
          </Link>
        </div>
      </div>
    </div>
  );
}

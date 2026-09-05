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
    <div className="sticky top-0 z-10 border-b border-border backdrop-blur-md bg-background/85">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
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

        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hidden flex-1 justify-center">
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

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/auth/sign-in"
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-85"
            style={{ background: "var(--accent-mv)" }}
          >
            Connect
          </Link>
        </div>
      </div>
    </div>
  );
}

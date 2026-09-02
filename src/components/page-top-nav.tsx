import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/universes", label: "Universes" },
  { href: "/moments", label: "Moments" },
  { href: "/murals", label: "Murals" },
  { href: "/scenes", label: "Scenes" },
  { href: "/participants", label: "Participants" },
  { href: "/authority/public", label: "Authority" },
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
                className="px-3 py-1.5 text-sm rounded-md transition-colors"
                style={
                  isActive
                    ? { color: "var(--accent-mv)", fontWeight: 600 }
                    : undefined
                }
              >
                <span className={isActive ? "" : "text-muted-foreground hover:text-foreground"}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm cursor-default select-none">⌕</span>
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

import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/universes", label: "Universes" },
  { href: "/moments", label: "Moments" },
  { href: "/murals", label: "Murals" },
  { href: "/scenes", label: "Scenes" },
  { href: "/participants", label: "Participants" },
  { href: "/authority/public", label: "Authority" },
  { href: "/about", label: "About" },
];

const CORE_PRINCIPLES = [
  { icon: "◎", label: "Universe", sub: "Top level container (Song World reimagined)" },
  { icon: "▦", label: "Mural", sub: "Animated video (visual world)" },
  { icon: "◻", label: "Scene", sub: "Chapter / segment within a mural" },
  { icon: "◈", label: "Creative Moment", sub: "Card (collectible moment)" },
  { icon: "⬡", label: "Authority", sub: "Governance, rights, and publication layer" },
];

export default function Nav() {
  return (
    <aside
      className="sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col border-r border-border overflow-y-auto lg:flex"
      style={{ background: "var(--sidebar)" }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "var(--accent-mv)", color: "#fff" }}
          >
            MV
          </div>
          <div>
            <p className="text-xs font-bold tracking-tight text-foreground leading-none">MIGHTY VERSE</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">REIMAGINED</p>
          </div>
        </Link>
        <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
          Own the Moment. Shape the Universe.
        </p>
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          A next-generation platform for music universes, animated murals, and creative moments.
        </p>
      </div>

      {/* Core Principles */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Core Principles
        </p>
        <ul className="space-y-2">
          {CORE_PRINCIPLES.map((p) => (
            <li key={p.label} className="flex items-start gap-2">
              <span className="text-[11px] mt-0.5 shrink-0" style={{ color: "var(--accent-mv)" }}>
                {p.icon}
              </span>
              <div>
                <p className="text-[11px] font-medium text-foreground leading-none">{p.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{p.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Experience Pillars */}
      <div className="px-5 pt-2 pb-3 border-t border-border">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Experience Pillars
        </p>
        <div className="grid grid-cols-4 gap-1">
          {[
            { icon: "🔭", label: "DISCOVER", sub: "Explore Universes" },
            { icon: "⚡", label: "MOMENTS", sub: "Collect & Engage" },
            { icon: "✦", label: "CREATE", sub: "Build & Contribute" },
            { icon: "⬡", label: "AUTHORITY", sub: "Govern & Publish" },
          ].map((p) => (
            <div key={p.label} className="flex flex-col items-center text-center gap-0.5">
              <span className="text-base">{p.icon}</span>
              <p className="text-[8px] font-bold text-foreground leading-none">{p.label}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{p.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Global Navigation */}
      <nav className="px-3 pt-2 pb-3 border-t border-border flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
          Global Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Connect Wallet */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
            style={{ background: "var(--accent-mv)" }}
          >
            ◎
          </div>
          <div>
            <p className="text-[11px] font-semibold text-foreground leading-none">Connect Wallet</p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Sign in to collect, contribute and own your moments.
            </p>
          </div>
        </div>
        <button
          className="w-full py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-mv)" }}
        >
          Connect Wallet
        </button>
      </div>

      {/* Social + Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-3 mb-2">
          {["𝕏", "⬡", "◎", "▶"].map((icon) => (
            <button
              key={icon}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              {icon}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground">© 2026 Mighty Verse Reimagined</p>
        <p className="text-[9px] text-muted-foreground">All rights reserved.</p>
      </div>
    </aside>
  );
}

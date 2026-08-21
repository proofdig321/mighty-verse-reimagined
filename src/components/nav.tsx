import Link from "next/link";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-2xl px-4 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="text-foreground text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          Mighty Verse
        </Link>
        <Link href="/" className="text-muted-foreground text-xs hover:text-foreground transition-colors">
          Home
        </Link>
      </div>
    </nav>
  );
}

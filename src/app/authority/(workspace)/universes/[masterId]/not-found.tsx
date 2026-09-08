import Link from "next/link";

export default function UniverseCurationNotFound() {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Universe curation</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Universe not found</h1>
      <p className="text-sm text-muted-foreground">
        This identifier is not a canonical Universe, or it does not exist.
      </p>
      <Link href="/authority/universes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Universes
      </Link>
    </div>
  );
}

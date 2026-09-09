"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const JOURNEY = [
  { n: "01", label: "Create", verb: "Establish", href: "/authority/create" },
  { n: "02", label: "Curate", verb: "Shape", href: "/authority/curate" },
  { n: "03", label: "Studio", verb: "Compose", href: "/authority/universes" },
] as const;

export function WorkspaceJourney({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Creative journey" className={compact ? "space-y-2" : "space-y-3"}>
      <p className="px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/50">
        Journey
      </p>
      <ol className="space-y-0.5">
        {JOURNEY.map((step, index) => {
          const active =
            step.href === "/authority/universes"
              ? pathname === step.href || pathname.startsWith("/authority/universes/")
              : pathname === step.href || pathname.startsWith(`${step.href}?`);
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground/70">{step.n}</span>
                <span className="font-medium">{step.label}</span>
                {!compact && (
                  <span className="text-[10px] text-muted-foreground/60">{step.verb}</span>
                )}
                {index < JOURNEY.length - 1 && (
                  <span className="sr-only">then</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="px-3 text-[10px] leading-relaxed text-muted-foreground/60">
        Experience is public. Sentinel observes throughout.
      </p>
    </nav>
  );
}

import Link from "next/link";
import type { DistributionReadiness } from "@/lib/media/distribution-readiness";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DistributionReadinessPanel({ readiness }: { readiness: DistributionReadiness }) {
  return (
    <div className="space-y-3" data-distribution-readiness={readiness.readyForCanonicalHome ? "home" : "incomplete"}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Distribution</p>
      <div className="rounded-lg border border-border bg-card/30 px-4 py-4 space-y-4">
        <p className="text-sm text-foreground">{readiness.note}</p>
        <ul className="space-y-2">
          {readiness.gates.map((gate) => (
            <li
              key={gate.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/70 px-3 py-2"
              data-distribution-gate={gate.id}
              data-ready={gate.ready ? "true" : "false"}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {gate.ready ? "Ready" : "Needs curator"} · {gate.label}
                </p>
                <p className="text-sm text-foreground mt-1">{gate.summary}</p>
              </div>
              {gate.href && gate.actionLabel ? (
                <Link href={gate.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  {gate.actionLabel}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">External projections</p>
          {readiness.external.map((item) => (
            <p key={item.platform} className="text-xs text-muted-foreground" data-external-projection={item.platform}>
              {item.platform}: not live. {item.summary}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

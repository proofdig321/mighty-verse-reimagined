import { Badge } from "@/components/ui/badge";
import type { EvidenceStatus } from "@/lib/media/cinematic-evidence";

/**
 * EvidenceBadge — visually distinguishes Sentinel evidence states.
 *
 * CRITICAL: Sentinel observes. It does not author creative truth.
 * These badges must never make AI-generated analysis look like
 * curator-authorised canonical metadata.
 *
 * observed   — directly seen in the media
 * inferred   — derived from evidence, not directly seen
 * unknown    — insufficient evidence
 * authorised — curator has explicitly authorised this as canonical
 */
export function EvidenceBadge({
  status,
  label,
}: {
  status: EvidenceStatus | "authorised";
  label?: string;
}) {
  if (status === "authorised") {
    return (
      <Badge
        variant="default"
        className="gap-1 bg-primary/20 text-primary border-primary/30 hover:bg-primary/20"
      >
        <span className="size-1.5 rounded-full bg-primary inline-block" />
        {label ?? "Authorised"}
      </Badge>
    );
  }

  if (status === "observed") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
        {label ?? "Observed"}
      </Badge>
    );
  }

  if (status === "inferred") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-400 inline-block" />
        {label ?? "Inferred"}
      </Badge>
    );
  }

  // unknown
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/40 inline-block" />
      {label ?? "Unknown"}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const map = {
    high: "border-emerald-500/40 text-emerald-400",
    medium: "border-amber-500/40 text-amber-400",
    low: "text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`capitalize ${map[confidence]}`}>
      {confidence}
    </Badge>
  );
}

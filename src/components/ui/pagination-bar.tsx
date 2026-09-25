import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/lib/pagination";
import { pageHref } from "@/lib/pagination";

interface PaginationBarProps {
  meta: PageMeta;
  basePath: string;
  /** Current search params to preserve (e.g. filters). Omit "page". */
  searchParams?: Record<string, string>;
  className?: string;
}

/**
 * Reusable pagination bar. Server-rendered — no client state.
 * Renders nothing when there is only one page.
 */
export function PaginationBar({ meta, basePath, searchParams = {}, className }: PaginationBarProps) {
  if (meta.totalPages <= 1) return null;

  const prevHref = meta.hasPrev ? pageHref(basePath, searchParams, meta.page - 1) : null;
  const nextHref = meta.hasNext ? pageHref(basePath, searchParams, meta.page + 1) : null;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-4 text-xs text-muted-foreground", className)}
    >
      <span>
        Page {meta.page} of {meta.totalPages}
        <span className="ml-2 text-muted-foreground/50">({meta.total} total)</span>
      </span>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 hover:bg-accent/30 transition-colors"
          >
            <ChevronLeft size={13} /> Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 opacity-30 cursor-not-allowed">
            <ChevronLeft size={13} /> Previous
          </span>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 hover:bg-accent/30 transition-colors"
          >
            Next <ChevronRight size={13} />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 opacity-30 cursor-not-allowed">
            Next <ChevronRight size={13} />
          </span>
        )}
      </div>
    </nav>
  );
}

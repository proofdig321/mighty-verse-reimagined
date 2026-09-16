"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const CATALOGUE_PAGE_SIZE = 8;

export function CollectionPager({
  page,
  pageSize,
  total,
  onPage,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (total <= pageSize) return null;
  const start = page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="studio-pager" role="navigation" aria-label={label}>
      <span className="studio-pager-range">
        {start}–{end} of {total}
      </span>
      <Button type="button" variant="ghost" size="xs" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={end >= total} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

export function PaginatedItems<T>({
  items,
  pageSize = CATALOGUE_PAGE_SIZE,
  label,
  children,
}: {
  items: T[];
  pageSize?: number;
  label: string;
  children: (pageItems: T[]) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.min(page, maxPage);
  const slice = useMemo(
    () => items.slice(current * pageSize, (current + 1) * pageSize),
    [items, current, pageSize],
  );

  return (
    <div className="space-y-3">
      {children(slice)}
      <CollectionPager page={current} pageSize={pageSize} total={total} onPage={setPage} label={label} />
    </div>
  );
}

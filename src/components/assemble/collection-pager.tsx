"use client";

import { Button } from "@/components/ui/button";

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

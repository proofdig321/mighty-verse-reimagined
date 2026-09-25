/**
 * Reusable pagination primitive.
 *
 * All growing lists in Mighty Verse use this module for consistent
 * offset/limit calculation and page metadata. Do not create one-off
 * pagination implementations for individual pages or routes.
 *
 * Usage (server page):
 *   const pg = parsePage(searchParams.page, searchParams.page_size);
 *   const { data, count } = await svc.from("...").select("*", { count: "exact" })
 *     .order("created_at", { ascending: false })
 *     .range(pg.from, pg.to);
 *   const meta = pageMeta(pg, count ?? 0);
 *
 * Usage (API route):
 *   const pg = parsePage(url.searchParams.get("page"), url.searchParams.get("page_size"));
 *   return NextResponse.json({ items: data, pagination: pageMeta(pg, total) });
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type PageParams = {
  /** 1-based page number. */
  page: number;
  /** Items per page. */
  pageSize: number;
  /** Supabase range start (0-based, inclusive). */
  from: number;
  /** Supabase range end (0-based, inclusive). */
  to: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Parse page and page_size from URL search params (string | null).
 * Clamps to valid ranges. Always returns a safe PageParams.
 */
export function parsePage(
  pageParam: string | null | undefined,
  pageSizeParam: string | null | undefined,
  defaultPageSize = DEFAULT_PAGE_SIZE,
): PageParams {
  const pageSize = Math.max(
    1,
    Math.min(MAX_PAGE_SIZE, parseInt(pageSizeParam ?? String(defaultPageSize), 10) || defaultPageSize),
  );
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

/**
 * Build page metadata from a PageParams and the total row count.
 */
export function pageMeta(pg: PageParams, total: number): PageMeta {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pg.pageSize);
  return {
    page: pg.page,
    pageSize: pg.pageSize,
    total,
    totalPages,
    hasNext: pg.page < totalPages,
    hasPrev: pg.page > 1,
  };
}

/**
 * Build a URL with updated page param, preserving other search params.
 * Used by PaginationBar to construct prev/next hrefs.
 */
export function pageHref(
  base: string,
  currentParams: Record<string, string>,
  targetPage: number,
): string {
  const params = new URLSearchParams(currentParams);
  params.set("page", String(targetPage));
  return `${base}?${params.toString()}`;
}

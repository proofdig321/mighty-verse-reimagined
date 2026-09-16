"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { occupancyLabel, type UniverseOccupancy } from "@/lib/assemble/occupancy";
import { cn } from "@/lib/utils";
import { PaginatedItems } from "./collection-pager";
import { WithdrawWork } from "./withdraw-work";

export type UniverseCatalogueRow = {
  master_id: string;
  title: string | null;
  description: string | null;
  muralCount: number;
  occupancy: UniverseOccupancy;
  withdrawable: boolean;
  openHref: string;
  openLabel: string;
  identityHref: string;
};

export function UniverseCatalogueTable({ rows }: { rows: UniverseCatalogueRow[] }) {
  return (
    <PaginatedItems items={rows} label="Universes">
      {(page) => (
        <div className="overflow-hidden rounded-xl border border-border bg-card/60">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Universe</th>
                <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:table-cell">Occupancy</th>
                <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">Murals</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.map((u) => (
                <tr key={u.master_id} className="transition-colors hover:bg-muted/20" data-occupancy={u.occupancy}>
                  <td className="px-4 py-3">
                    <Link href={u.openHref} className="font-medium text-foreground hover:underline">
                      {u.title ?? <span className="italic text-muted-foreground">Untitled universe</span>}
                    </Link>
                    {u.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{u.description}</p>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge variant={u.occupancy === "orphan" ? "destructive" : "outline"}>{occupancyLabel(u.occupancy)}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <Badge variant="outline">{u.muralCount}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link href={u.identityHref} className={cn(buttonVariants({ size: "sm" }))}>
                        Edit
                      </Link>
                      <Link href={u.openHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                        {u.openLabel}
                      </Link>
                      {u.withdrawable ? (
                        <WithdrawWork masterId={u.master_id} title={u.title} occupancy={u.occupancy} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaginatedItems>
  );
}

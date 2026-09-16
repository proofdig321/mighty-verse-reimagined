"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { UniverseOccupancy } from "@/lib/assemble/occupancy";
import { cn } from "@/lib/utils";
import { PaginatedItems } from "./collection-pager";
import { WithdrawWork } from "./withdraw-work";

export type CatalogueRecord = {
  masterId: string;
  kicker: string;
  title: string | null;
  untitled: string;
  description?: string | null;
  badges?: string[];
  meta?: { label: string; value: string; href?: string }[];
  editHref: string;
  openHref?: string;
  openLabel?: string;
  withdrawable?: boolean;
  occupancy?: UniverseOccupancy | null;
};

export function CatalogueRecordList({
  items,
  label,
}: {
  items: CatalogueRecord[];
  label: string;
}) {
  return (
    <PaginatedItems items={items} label={label}>
      {(page) => (
        <ul className="grid gap-3 md:grid-cols-2">
          {page.map((item) => (
            <li key={item.masterId}>
              <CatalogueRecordCard record={item} />
            </li>
          ))}
        </ul>
      )}
    </PaginatedItems>
  );
}

function CatalogueRecordCard({ record }: { record: CatalogueRecord }) {
  return (
    <Card className="h-full bg-card/80" size="sm" data-catalogue-record={record.masterId}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{record.kicker}</p>
          {record.badges?.length ? (
            <div className="flex flex-wrap justify-end gap-1">
              {record.badges.map((badge) => (
                <Badge key={badge} variant="outline">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <CardTitle>
          <Link href={record.editHref} className="hover:underline">
            {record.title ?? <span className="italic text-muted-foreground">{record.untitled}</span>}
          </Link>
        </CardTitle>
        {record.description ? <CardDescription className="line-clamp-2">{record.description}</CardDescription> : null}
      </CardHeader>
      {record.meta?.length ? (
        <CardContent>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {record.meta.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 text-foreground">
                  {item.href ? (
                    <Link href={item.href} className="hover:underline">
                      {item.value}
                    </Link>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Link href={record.editHref} className={cn(buttonVariants({ size: "sm" }))}>
          Edit
        </Link>
        {record.openHref && record.openLabel ? (
          <Link href={record.openHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            {record.openLabel}
          </Link>
        ) : null}
        {record.withdrawable ? (
          <WithdrawWork masterId={record.masterId} title={record.title} occupancy={record.occupancy} />
        ) : null}
      </CardFooter>
    </Card>
  );
}

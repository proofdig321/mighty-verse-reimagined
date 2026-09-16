"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { UniverseOccupancy } from "@/lib/assemble/occupancy";
import { cn } from "@/lib/utils";
import { WithdrawWork } from "./withdraw-work";

export function CatalogueRecordCard({
  kicker,
  title,
  untitled,
  description,
  badges,
  meta,
  editHref,
  openHref,
  openLabel,
  masterId,
  withdrawable,
  occupancy,
}: {
  kicker: string;
  title: string | null;
  untitled: string;
  description?: string | null;
  badges?: string[];
  meta?: { label: string; value: ReactNode }[];
  editHref: string;
  openHref?: string;
  openLabel?: string;
  masterId: string;
  withdrawable?: boolean;
  occupancy?: UniverseOccupancy | null;
}) {
  return (
    <Card className="h-full bg-card/80" size="sm" data-catalogue-record={masterId}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{kicker}</p>
          {badges?.length ? (
            <div className="flex flex-wrap justify-end gap-1">
              {badges.map((badge) => (
                <Badge key={badge} variant="outline">
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <CardTitle>
          <Link href={editHref} className="hover:underline">
            {title ?? <span className="italic text-muted-foreground">{untitled}</span>}
          </Link>
        </CardTitle>
        {description ? <CardDescription className="line-clamp-2">{description}</CardDescription> : null}
      </CardHeader>
      {meta?.length ? (
        <CardContent>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            {meta.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap items-center gap-2">
        <Link href={editHref} className={cn(buttonVariants({ size: "sm" }))}>
          Edit
        </Link>
        {openHref && openLabel ? (
          <Link href={openHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            {openLabel}
          </Link>
        ) : null}
        {withdrawable ? <WithdrawWork masterId={masterId} title={title} occupancy={occupancy} /> : null}
      </CardFooter>
    </Card>
  );
}

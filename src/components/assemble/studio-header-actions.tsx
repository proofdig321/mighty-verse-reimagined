"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function StudioHeaderActions({
  universeId,
  identityHref,
  showIdentityAction,
  extra,
}: {
  universeId: string;
  identityHref?: string | null;
  showIdentityAction?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="studio-header-actions">
      {extra}
      <Link href={`/worlds/${universeId}/holographic`} className={buttonVariants({ size: "sm" })} data-experience-entry="holographic">
        Holographic Experience
      </Link>
      <Link href={`/worlds/${universeId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        Enter 2.5D
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
          aria-label="Studio actions"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          {showIdentityAction && identityHref ? (
            <DropdownMenuLinkItem href={identityHref} closeOnClick>
              Edit identity
            </DropdownMenuLinkItem>
          ) : null}
          <DropdownMenuLinkItem href={`/authority/${universeId}`} closeOnClick>
            Open record
          </DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

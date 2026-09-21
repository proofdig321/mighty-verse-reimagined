"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function StudioOverflowMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="icon-sm" aria-label={label}>
            <MoreHorizontal size={14} />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StudioOverflowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuLinkItem href={href}>
      {children}
    </DropdownMenuLinkItem>
  );
}

export function StudioOverflowItem({
  children,
  onSelect,
  disabled,
  destructive,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      disabled={disabled}
      variant={destructive ? "destructive" : "default"}
    >
      {children}
    </DropdownMenuItem>
  );
}

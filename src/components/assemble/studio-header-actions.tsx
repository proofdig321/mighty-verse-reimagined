"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StudioOverflowLink, StudioOverflowMenu } from "./studio-overflow-menu";

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
      <StudioOverflowMenu label="Studio actions">
        {showIdentityAction && identityHref ? (
          <StudioOverflowLink href={identityHref}>Edit identity</StudioOverflowLink>
        ) : null}
        <StudioOverflowLink href={`/authority/${universeId}`}>Open record</StudioOverflowLink>
      </StudioOverflowMenu>
    </div>
  );
}

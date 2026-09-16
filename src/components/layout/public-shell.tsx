"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import PageTopNav from "@/components/page-top-nav";
import { PublicFooter } from "@/components/layout/public-footer";

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="multiverse-page min-h-screen w-full overflow-x-hidden flex flex-col">
      <PageTopNav activePath={pathname} />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import PageTopNav from "@/components/page-top-nav";

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="multiverse-page min-h-screen w-full overflow-x-hidden">
      <PageTopNav activePath={pathname} />
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { requireStudioUser } from "@/lib/assemble/studio-session";
import { buttonVariants } from "@/components/ui/button";
import PageTopNav from "@/components/page-top-nav";
import { cn } from "@/lib/utils";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  await requireStudioUser("/studio");

  return (
    <div className="multiverse-page min-h-screen bg-background">
      <PageTopNav activePath="/studio" />
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Studio</p>
            <p className="text-sm text-foreground">Imagine → Story → Visualise → Generate</p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Studio">
            <Link href="/studio" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Studio home
            </Link>
            <Link href="/studio/work" className={cn(buttonVariants({ size: "sm" }))}>
              New creative work
            </Link>
            <Link href="/authority" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Dashboard
            </Link>
          </nav>
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}

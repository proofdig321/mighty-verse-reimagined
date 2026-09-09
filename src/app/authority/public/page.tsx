import Link from "next/link";
import PageTopNav from "@/components/page-top-nav";
import { buttonVariants } from "@/components/ui/button";
import { CREATIVE_STUDIO_HREF, DASHBOARD_HREF } from "@/lib/product-nav";
import { cn } from "@/lib/utils";

export default function AuthorityPublicPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageTopNav activePath="/authority/public" />
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Assemble</p>
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Creative Studio
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Sign in to assemble a Universe in Creative Studio, or continue from the Authority dashboard.
            Studio is not the public Experience.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={CREATIVE_STUDIO_HREF} className={cn(buttonVariants({ size: "lg" }))} data-product-nav="studio">
            Open Creative Studio
          </Link>
          <Link href={DASHBOARD_HREF} className={cn(buttonVariants({ variant: "outline", size: "lg" }))} data-dashboard-surface="dashboard">
            Open Dashboard
          </Link>
          <Link href="/universes" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Discover Universes
          </Link>
        </div>
      </div>
    </div>
  );
}

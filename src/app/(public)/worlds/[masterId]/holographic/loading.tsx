import { Skeleton } from "@/components/ui/skeleton";

export default function HolographicLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-card/20">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="mv-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-8 space-y-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-10 w-64 md:w-96" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      {/* Cinema skeleton */}
      <div className="w-full bg-black/80">
        <Skeleton className="aspect-video w-full max-h-[70vh] rounded-none" />
      </div>
    </div>
  );
}

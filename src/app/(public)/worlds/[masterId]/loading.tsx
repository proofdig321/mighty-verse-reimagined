import { Skeleton } from "@/components/ui/skeleton";

export default function WorldLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="mv-hero-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-8 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-64 md:w-96" />
          <Skeleton className="h-4 w-80" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="world-experience">
        {/* Mural section */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="aspect-video w-full rounded-lg" />
        </div>

        {/* Scenes section */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-32" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>

        {/* Creative Moments section */}
        <div className="space-y-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

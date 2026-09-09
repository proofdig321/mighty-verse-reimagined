export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadCurateHub } from "@/lib/assemble/load-curate-hub";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";
import { CURATE_STUDIO_HREF, creativeSuiteHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { CurateHub } from "@/components/assemble/curate-hub";
import { CurateUniverseSelect } from "@/components/assemble/curate-universe-select";
import { buttonVariants } from "@/components/ui/button";

export default async function CurateHubPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const [hub, studio] = await Promise.all([
    loadCurateHub(universeId),
    loadCurateStudioMedia(),
  ]);
  if (!hub) notFound();

  return (
    <div className="space-y-8">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: CURATE_STUDIO_HREF },
          { label: hub.universeTitle },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Shape the work
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Curate</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Here is what is true about this Universe, what needs your attention, and where to go next.
            Actions open their own pages. Sentinel observes — it does not decide canonical meaning.
          </p>
        </div>
        <Link
          href={creativeSuiteHref(hub.universeId, "curate")}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open Creative Studio
        </Link>
      </div>

      <CurateUniverseSelect
        universes={studio.universes}
        selectedUniverseId={hub.universeId}
      />

      <CurateHub snapshot={hub} />
    </div>
  );
}

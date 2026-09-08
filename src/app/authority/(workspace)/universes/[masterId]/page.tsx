export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import UniverseAssemblyView from "@/components/assemble/universe-assembly";
import { buttonVariants } from "@/components/ui/button";

export default async function UniverseCurationPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();

  const title = data.title ?? "Untitled universe";

  return (
    <div className="space-y-10">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Universes", href: "/authority/universes" },
          { label: title },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Universe curation
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Assemble this Universe from its canonical Mural, Scenes, and Creative Moments.
            Editing those layers is added in later increments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={`/worlds/${data.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View public experience
          </Link>
          <Link href={`/authority/${data.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Canonical record
          </Link>
        </div>
      </div>

      <UniverseAssemblyView
        data={data}
        openHref={(id) => `/authority/${id}`}
        openLabel="Open record"
      />
    </div>
  );
}

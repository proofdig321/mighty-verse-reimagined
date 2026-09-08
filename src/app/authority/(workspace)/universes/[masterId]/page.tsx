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
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ identity?: string }>;
}) {
  const { masterId } = await params;
  const query = await searchParams;

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
            Assemble this Universe from its canonical identity, Mural, Scenes, and Creative Moments.
            Identity can be curated now. Mural, Scene, and Creative Moment editing are later increments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={`/authority/universes/${data.master_id}/identity`} className={buttonVariants({ size: "sm" })}>
            Edit identity
          </Link>
          <Link href={`/worlds/${data.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View public experience
          </Link>
          <Link href={`/authority/${data.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Canonical record
          </Link>
        </div>
      </div>

      {query.identity === "saved" && (
        <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          Universe identity saved.
        </p>
      )}

      <UniverseAssemblyView
        data={data}
        openHref={(id) => `/authority/${id}`}
        openLabel="Open record"
      />
    </div>
  );
}

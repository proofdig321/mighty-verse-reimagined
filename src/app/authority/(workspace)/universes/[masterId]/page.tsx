export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { creativeSuiteNavItems } from "@/lib/assemble/suite";
import { loadSentinelIntelligence } from "@/lib/assemble/load-sentinel-intelligence";
import { CURATE_STUDIO_HREF, creativeSuiteHref, creativeSuiteIdentityHref, mediaInspectHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { CreativeSuiteNav } from "@/components/assemble/creative-suite-nav";
import UniverseAssemblyView from "@/components/assemble/universe-assembly";
import { RegisterMural } from "@/components/assemble/register-mural";
import { buttonVariants } from "@/components/ui/button";

export default async function UniverseCurationPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ identity?: string; from?: string }>;
}) {
  const { masterId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const data = await loadUniverseAssembly(masterId);
  if (!data) notFound();
  const intelligence = await loadSentinelIntelligence(data);
  const inspectAssetId = data.murals.flatMap((mural) => mural.scenes).find((scene) => scene.asset_id)?.asset_id ?? null;

  const title = data.title ?? "Untitled universe";
  const fromCurate = query.from === "curate";
  const suiteHref = creativeSuiteHref(data.master_id, fromCurate ? "curate" : null);

  return (
    <div className="space-y-10">
      <HierarchyBreadcrumb
        items={
          fromCurate
            ? [
                { label: "Authority", href: "/authority" },
                { label: "Curate", href: CURATE_STUDIO_HREF },
                { label: title },
              ]
            : [
                { label: "Authority", href: "/authority" },
                { label: "Universes", href: "/authority/universes" },
                { label: title },
              ]
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Creative Suite
          </p>
          <h1
            className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {title}
          </h1>
          {data.description ? (
            <p className="text-base text-foreground/80 max-w-3xl">{data.description}</p>
          ) : null}
          <p className="text-sm text-muted-foreground max-w-3xl">
            Inside this Universe: its Mural, Scenes, and Creative Moments as a composition surface.
            Universe identity, Sentinel intelligence, Scene identity, Scene timing, canonical Scene order, Creative Moment identity, and Scene ↔ Creative Moment presence can be authored here.
            Sentinel remembers observations. The curator authorises Sentinel windows. Sentinel does not create Scenes. Scene Deck shuffle stays presentation-only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={`/worlds/${data.master_id}`} className={buttonVariants({ size: "sm" })}>
            Enter Experience
          </Link>
          <Link href={creativeSuiteIdentityHref(data.master_id, fromCurate ? "curate" : null)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit identity
          </Link>
          <Link href={`/authority/${data.master_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Canonical record
          </Link>
        </div>
      </div>

      <CreativeSuiteNav items={creativeSuiteNavItems(suiteHref)} />

      {query.identity === "saved" && (
        <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          Universe identity saved.
        </p>
      )}

      <UniverseAssemblyView
        data={data}
        openHref={(id) => `/authority/${id}`}
        openLabel="Open record"
        experienceHref={`/worlds/${data.master_id}`}
        canAuthorPresence
        canAuthorIdentity
        canAuthorTiming
        canAuthorOrder
        canAuthoriseSentinel
        intelligence={intelligence}
        inspectHref={inspectAssetId ? mediaInspectHref(inspectAssetId) : null}
        holographicHref={`/worlds/${data.master_id}/holographic`}
        muralEmptyAction={
          <RegisterMural
            universeId={data.master_id}
            universeTitle={data.title}
            fromCurate={fromCurate}
          />
        }
      />
    </div>
  );
}

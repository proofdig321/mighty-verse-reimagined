export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { creativeSuiteNavItems } from "@/lib/assemble/suite";
import { creativeSuiteHref, curateHubHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { CreativeSuiteNav } from "@/components/assemble/creative-suite-nav";
import IdentityCurationClient from "./identity-curation-client";

export default async function UniverseIdentityPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ from?: string }>;
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
  const fromCurate = query.from === "curate";
  const suiteHref = creativeSuiteHref(data.master_id, fromCurate ? "curate" : null);

  return (
    <div className="space-y-10">
      <HierarchyBreadcrumb
        items={
          fromCurate
            ? [
                { label: "Authority", href: "/authority" },
                { label: "Curate", href: curateHubHref(data.master_id) },
                { label: title, href: suiteHref },
                { label: "Identity" },
              ]
            : [
                { label: "Authority", href: "/authority" },
                { label: "Universes", href: "/authority/universes" },
                { label: title, href: suiteHref },
                { label: "Identity" },
              ]
        }
      />

      <div className="space-y-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Creative Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Curate the canonical title and description for this Universe.
          Scene identity, Scene timing, canonical Scene order, and Creative Moment identity are authored on the composition objects. Mural editing remains a later increment.
        </p>
      </div>

      <CreativeSuiteNav items={creativeSuiteNavItems(suiteHref, "identity")} current="identity" />

      <IdentityCurationClient
        masterId={data.master_id}
        title={data.title ?? ""}
        description={data.description ?? ""}
        fromCurate={fromCurate}
      />
    </div>
  );
}

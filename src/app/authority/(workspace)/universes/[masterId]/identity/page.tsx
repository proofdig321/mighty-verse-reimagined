export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import IdentityCurationClient from "./identity-curation-client";

export default async function UniverseIdentityPage({
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
          { label: title, href: `/authority/universes/${data.master_id}` },
          { label: "Identity" },
        ]}
      />

      <div className="space-y-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Universe identity
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Curate the canonical title and description for this Universe.
          Mural, Scene, and Creative Moment editing remain later increments.
        </p>
      </div>

      <IdentityCurationClient
        masterId={data.master_id}
        title={data.title ?? ""}
        description={data.description ?? ""}
      />
    </div>
  );
}

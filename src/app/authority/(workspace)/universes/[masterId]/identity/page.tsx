export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { creativeSuiteHref } from "@/lib/assemble/studio";
import { StudioWorkspaceShell } from "@/components/assemble/studio-workspace-shell";
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
    <StudioWorkspaceShell
      universeId={data.master_id}
      title={title}
      current="identity"
      suiteHref={suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Identity"
      showIdentityAction={false}
      lead="Curate the canonical title and description. Scene identity, Scene timing, canonical Scene order, and Creative Moment identity are authored on those objects."
    >
      <IdentityCurationClient
        masterId={data.master_id}
        title={data.title ?? ""}
        description={data.description ?? ""}
        fromCurate={fromCurate}
      />
    </StudioWorkspaceShell>
  );
}

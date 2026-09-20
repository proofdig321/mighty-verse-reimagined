export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly, suiteScenes } from "@/lib/assemble";
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
  const assembly = data!;

  const title = assembly.title ?? "Untitled universe";
  const fromCurate = query.from === "curate";
  const suiteHref = creativeSuiteHref(assembly.master_id, fromCurate ? "curate" : null);

  return (
    <StudioWorkspaceShell
      universeId={assembly.master_id}
      title={title}
      description={assembly.description}
      current="identity"
      suiteHref={suiteHref}
      fromCurate={fromCurate}
      workspaceLabel="Identity"
      sceneCount={suiteScenes(assembly).length}
      showIdentityAction={false}
      lead="Curate the canonical title and description. Scene identity, Scene timing, canonical Scene order, and Creative Moment identity are authored on those objects."
    >
      <IdentityCurationClient
        masterId={assembly.master_id}
        title={assembly.title ?? ""}
        description={assembly.description ?? ""}
        fromCurate={fromCurate}
      />
    </StudioWorkspaceShell>
  );
}

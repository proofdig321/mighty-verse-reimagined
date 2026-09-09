export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { loadInspectionContext } from "@/lib/assemble/load-curate-inspection";
import { CURATE_STUDIO_HREF, curateHubHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import CurateClient from "../../curate-client";

export default async function CurateSentinelPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const assembly = await loadUniverseAssembly(universeId);
  if (!assembly) notFound();

  const title = assembly.title ?? "Untitled universe";
  const inspection = await loadInspectionContext(assembly.master_id, [assembly.master_id]);

  return (
    <div className="space-y-8">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: CURATE_STUDIO_HREF },
          { label: title, href: curateHubHref(assembly.master_id) },
          { label: "Sentinel" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Evidence · Establish Scenes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Sentinel</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Evidence only. Candidate beats are not canonical Scenes until you authorise them.
          Sentinel does not decide Universe, Mural, Scene, contributor, or publication.
        </p>
      </div>

      <CurateClient
        mural={inspection.mural}
        scenes={inspection.scenes}
        availableAssets={inspection.availableAssets}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { CURATE_STUDIO_HREF, curateHubHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { RegisterCreativeMoment } from "@/components/assemble/register-creative-moment";

export default async function CurateMomentPage({
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

  return (
    <div className="space-y-8">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: CURATE_STUDIO_HREF },
          { label: title, href: curateHubHref(assembly.master_id) },
          { label: "Add Creative Moment" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Shape the work
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Add Creative Moment</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Register a Creative Moment on {title}. It is parented to the Universe, not owned by the
          Mural. Scene presence is authored later in Creative Studio.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-4 max-w-2xl">
        <RegisterCreativeMoment
          universeId={assembly.master_id}
          universeTitle={assembly.title}
          defaultOpen
        />
      </div>
    </div>
  );
}

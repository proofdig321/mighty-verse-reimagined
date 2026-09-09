export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadUniverseAssembly } from "@/lib/assemble";
import { CURATE_STUDIO_HREF, curateHubHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { RegisterMural } from "@/components/assemble/register-mural";
import { buttonVariants } from "@/components/ui/button";

export default async function CurateMuralPage({
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
  const mural = assembly.murals[0] ?? null;
  const hubHref = curateHubHref(assembly.master_id);

  return (
    <div className="space-y-8">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: CURATE_STUDIO_HREF },
          { label: title, href: hubHref },
          { label: "Register Mural" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Shape the work
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Register Mural</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          A Mural is the audiovisual expression of {title}. Registration is canonical, not minting.
          It does not attach media, create Scenes, or publish Experience.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-4 max-w-2xl">
        {mural ? (
          <div className="space-y-3" role="status">
            <p className="text-sm text-foreground">
              {title} already has its Mural{mural.title ? `: ${mural.title}` : ""}.
            </p>
            <Link href={hubHref} className={buttonVariants({ size: "sm" })}>
              Back to Curate
            </Link>
          </div>
        ) : (
          <RegisterMural
            universeId={assembly.master_id}
            universeTitle={assembly.title}
            fromCurate
            defaultOpen
          />
        )}
      </div>
    </div>
  );
}

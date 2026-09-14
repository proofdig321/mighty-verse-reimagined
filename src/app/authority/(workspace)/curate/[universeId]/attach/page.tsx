export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { loadCurateHub } from "@/lib/assemble/load-curate-hub";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";
import { CURATE_STUDIO_HREF, curateHubHref, curateMuralHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import { AssociateWithUniverse } from "@/components/assemble/associate-with-universe";
import { buttonVariants } from "@/components/ui/button";

export default async function CurateAttachPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const [hub, studio] = await Promise.all([
    loadCurateHub(universeId),
    loadCurateStudioMedia(),
  ]);
  if (!hub) notFound();

  const title = hub.universeTitle;
  const hubHref = curateHubHref(hub.universeId);
  const target = studio.universes.find((universe) => universe.master_id === hub.universeId) ?? null;
  const assetId = hub.boundAssetId ?? hub.incomingAssetId;
  const attachMedia = assetId
    ? studio.media.find((item) => item.asset_id === assetId) ?? null
    : null;

  return (
    <div className="space-y-8">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate", href: CURATE_STUDIO_HREF },
          { label: title, href: hubHref },
          { label: "Attach media" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Shape the work
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Attach media</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Bind ingested source media to {title}&apos;s existing Mural. This does not create a Universe
          and does not replace Super Hero Ego.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-4 max-w-2xl">
        {!hub.muralRegistered ? (
          <div className="space-y-3" role="status">
            <p className="text-sm text-foreground">
              {title} has no Mural yet. Register the Mural before attaching media.
            </p>
            <Link href={curateMuralHref(hub.universeId)} className={buttonVariants({ size: "sm" })}>
              Register Mural
            </Link>
          </div>
        ) : attachMedia && target ? (
          <AssociateWithUniverse
            media={attachMedia}
            universes={[target]}
            defaultOpen
            lockedUniverseId={hub.universeId}
          />
        ) : (
          <div className="space-y-3" role="status">
            <p className="text-sm text-foreground">
              No ingested source is waiting for {title}. Add media through intake, then return here.
            </p>
            <Link href="/authority/media/intake" className={buttonVariants({ size: "sm" })}>
              Add media
            </Link>
          </div>
        )}
        <Link href={hubHref} className="text-xs text-muted-foreground hover:underline">
          Back to Curate
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import {
  pinFocusedIncomingMedia,
  resolveCurateAssetFocus,
} from "@/lib/assemble/curate-context";
import { loadCurateStudioMedia } from "@/lib/assemble/load-studio";
import { curateHubHref } from "@/lib/assemble/studio";
import { HierarchyBreadcrumb } from "@/components/assemble/breadcrumb";
import CurateStudioGateway from "@/components/assemble/curate-studio-gateway";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CuratePage({
  searchParams,
}: {
  searchParams: Promise<{ universe?: string; asset?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { universe, asset } = await searchParams;
  const { media, universes } = await loadCurateStudioMedia();
  const requestedUniverseId =
    typeof universe === "string" && UUID_RE.test(universe.trim()) ? universe.trim() : null;
  const knownUniverse =
    requestedUniverseId && universes.some((item) => item.master_id === requestedUniverseId)
      ? requestedUniverseId
      : null;

  if (knownUniverse) {
    redirect(curateHubHref(knownUniverse));
  }

  const focusedAsset = resolveCurateAssetFocus({
    requestedAssetId: asset,
    media,
  });
  const incomingMedia = pinFocusedIncomingMedia(
    media,
    focusedAsset?.found ? focusedAsset.asset_id : null,
  );

  return (
    <div className="space-y-10">
      <HierarchyBreadcrumb
        items={[
          { label: "Authority", href: "/authority" },
          { label: "Curate" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Shape the work
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Curate</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Choose an existing Universe to continue shaping it. Incoming media stays here until you
          associate it. Create establishes new work. Creative Studio is for precision composition.
        </p>
        <p className="text-xs text-muted-foreground">
          CREATE → CURATE → CREATIVE STUDIO → EXPERIENCE
        </p>
      </div>

      <CurateStudioGateway
        media={incomingMedia}
        universes={universes}
        selectedUniverseId={null}
        focusedAsset={focusedAsset}
      />
    </div>
  );
}

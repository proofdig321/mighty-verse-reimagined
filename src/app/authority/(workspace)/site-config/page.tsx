export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { loadHeroConfig } from "@/lib/site-config";
import { HeroConfigPanel } from "@/components/assemble/hero-config-panel";

async function getVideoAssets() {
  const svc = getServiceClient();
  // Playable video assets: production role (Mux) or source video
  const { data: assets } = await svc
    .from("media_asset")
    .select("asset_id, storage_ref, provider, asset_type")
    .not("storage_ref", "like", "seed:placeholder:%")
    .not("storage_ref", "like", "discard:%")
    .order("created_at", { ascending: false });

  const { data: intakes } = await svc
    .from("media_intake")
    .select("asset_id, title, work_type")
    .not("asset_id", "is", null);

  const intakeMap = new Map(
    (intakes ?? []).map((i) => [i.asset_id, { title: i.title, work_type: i.work_type }])
  );

  return (assets ?? [])
    .filter((a) => {
      const intake = intakeMap.get(a.asset_id);
      const isVideo =
        intake?.work_type === "video" ||
        intake?.work_type === "animation" ||
        a.provider === "mux";
      return isVideo;
    })
    .map((a) => ({
      asset_id: a.asset_id,
      title: intakeMap.get(a.asset_id)?.title ?? null,
      provider: a.provider,
      storage_ref: a.storage_ref,
    }));
}

export default async function SiteConfigPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const [videoAssets, heroConfig] = await Promise.all([
    getVideoAssets(),
    loadHeroConfig(),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="suite-kicker">Platform</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Site Configuration</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Public home hero copy, background video, and CTA controls.
        </p>
      </div>
      <HeroConfigPanel videoAssets={videoAssets} initialConfig={heroConfig} />
    </div>
  );
}

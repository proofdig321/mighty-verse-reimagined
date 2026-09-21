import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServiceClient } from "@/lib/authority/validate";
import { sceneShortTitle } from "@/lib/assemble/composition";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { ENTER_2_5D_LABEL, HOLOGRAPHIC_EXPERIENCE_LABEL, public2_5dHref, publicHolographicHref } from "@/lib/experience/destinations";

type RelatedScene = {
  master_id: string;
  title: string | null;
  projection_id: string | null;
};

type CMPageData = {
  master_id: string;
  title: string | null;
  description: string | null;
  universe_master_id: string | null;
  universe_title: string | null;
  scenes: RelatedScene[];
};

async function getCMData(masterId: string): Promise<CMPageData | null> {
  const svc = getServiceClient();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, parent_master_id")
    .eq("master_id", masterId)
    .eq("canonical_type", "creative-moment")
    .single();
  if (!master) return null;

  const { data: pres } = await svc
    .from("work_presentation")
    .select("title, description")
    .eq("master_id", masterId)
    .maybeSingle();

  let universe_master_id: string | null = master.parent_master_id ?? null;
  let universe_title: string | null = null;
  if (universe_master_id) {
    const { data: uPres } = await svc.from("work_presentation").select("title").eq("master_id", universe_master_id).maybeSingle();
    universe_title = uPres?.title ?? null;
  }

  const { data: relations } = await svc
    .from("scene_moment")
    .select("scene_master_id, sort_order")
    .eq("moment_master_id", masterId)
    .eq("relationship_type", "primary")
    .order("sort_order", { ascending: true, nullsFirst: false });

  const sceneIds = [...new Set((relations ?? []).map((row) => row.scene_master_id))];
  const [{ data: scenePres }, { data: sceneProjs }] = sceneIds.length
    ? await Promise.all([
        svc.from("work_presentation").select("master_id, title").in("master_id", sceneIds),
        svc.from("projection").select("master_id, projection_id").in("master_id", sceneIds).eq("projection_type", "experiential"),
      ])
    : [{ data: [] }, { data: [] }];

  const scenes: RelatedScene[] = sceneIds.map((id) => ({
    master_id: id,
    title: (scenePres ?? []).find((row) => row.master_id === id)?.title ?? null,
    projection_id: (sceneProjs ?? []).find((row) => row.master_id === id)?.projection_id ?? null,
  }));

  return {
    master_id: masterId,
    title: pres?.title ?? null,
    description: pres?.description ?? null,
    universe_master_id,
    universe_title,
    scenes,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ masterId: string }>;
}): Promise<Metadata> {
  const { masterId } = await params;
  const svc = getServiceClient();
  const { data: pres } = await svc.from("work_presentation").select("title").eq("master_id", masterId).maybeSingle();
  const title = pres?.title ? `${pres.title} — Mighty Verse` : "Mighty Verse";
  return { title, description: title, openGraph: { title }, twitter: { card: "summary", title } };
}

export default async function CreativeMomentPage({
  params,
}: {
  params: Promise<{ masterId: string }>;
}) {
  const { masterId } = await params;
  const data = await getCMData(masterId);
  if (!data) notFound();
  const cm = data!;

  return (
    <div className="min-h-screen bg-background">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {cm.universe_master_id ? (
          <Link
            href={`/worlds/${cm.universe_master_id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} />
                Universe{cm.universe_title ? ` · ${cm.universe_title}` : ""}
          </Link>
        ) : null}

        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Creative Moment</p>
          <h1
            className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {cm.title ?? "Creative Moment"}
          </h1>
          {cm.description ? (
            <p className="text-lg text-muted-foreground max-w-2xl">{cm.description}</p>
          ) : null}
          {cm.universe_master_id && cm.universe_title ? (
            <p className="text-sm text-muted-foreground">
              Universe:{" "}
              <Link href={`/worlds/${cm.universe_master_id}`} className="text-foreground hover:opacity-70 transition-opacity">
                {cm.universe_title}
              </Link>
            </p>
          ) : null}
          {cm.universe_master_id ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={public2_5dHref(cm.universe_master_id)}
                className={buttonVariants({ size: "lg" })}
                data-experience-entry="2.5d"
              >
                {ENTER_2_5D_LABEL}
              </Link>
              <Link
                href={publicHolographicHref(cm.universe_master_id)}
                className={buttonVariants({ size: "lg", variant: "outline" })}
                data-experience-entry="holographic"
              >
                {HOLOGRAPHIC_EXPERIENCE_LABEL}
              </Link>
            </div>
          ) : null}
        </div>

        <Separator />

        <section className="space-y-3" aria-labelledby="creative-moment-scenes">
          <h2 id="creative-moment-scenes" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Related Scenes
          </h2>
          {cm.scenes.length > 0 ? (
            <ul className="space-y-2">
              {cm.scenes.map((scene) => (
                <li key={scene.master_id}>
                  {scene.projection_id ? (
                    <Link href={`/moments/${scene.projection_id}`} className="text-sm text-foreground hover:opacity-70 transition-opacity">
                      {sceneShortTitle(scene.title) ?? scene.title ?? "Scene"}
                    </Link>
                  ) : (
                    <span className="text-sm text-foreground">{sceneShortTitle(scene.title) ?? scene.title ?? "Scene"}</span>
                  )}
                  {scene.title && sceneShortTitle(scene.title) !== scene.title ? (
                    <span className="text-xs text-muted-foreground"> · {scene.title}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">This Creative Moment is not yet present in a Scene.</p>
          )}
        </section>

      </div>
    </div>
  );
}

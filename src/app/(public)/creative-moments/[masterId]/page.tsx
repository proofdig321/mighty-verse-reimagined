import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import MomentCard from "@/components/moment-card";
import { Separator } from "@/components/ui/separator";

type CMPageData = {
  master_id: string;
  title: string | null;
  description: string | null;
  universe_master_id: string | null;
  universe_title: string | null;
  projection_id: string | null;
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

  // Universe parent
  let universe_master_id: string | null = master.parent_master_id ?? null;
  let universe_title: string | null = null;
  if (universe_master_id) {
    const { data: uPres } = await svc.from("work_presentation").select("title").eq("master_id", universe_master_id).maybeSingle();
    universe_title = uPres?.title ?? null;
  }

  const { data: projection } = await svc
    .from("projection")
    .select("projection_id")
    .eq("master_id", masterId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  return {
    master_id: masterId,
    title: pres?.title ?? null,
    description: pres?.description ?? null,
    universe_master_id,
    universe_title,
    projection_id: projection?.projection_id ?? null,
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

  return (
    <div className="min-h-screen bg-background multiverse-page">

      {/* Breadcrumb → Universe */}
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-3">
        {data.universe_master_id && (
          <Link href={`/worlds/${data.universe_master_id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>←</span>
            <span>{data.universe_title ?? "Universe"}</span>
          </Link>
        )}
      </div>

      {/* Identity */}
      <div className="multiverse-stage border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 space-y-3">
          <h1
            className="text-5xl md:text-6xl font-semibold leading-none tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            {data.title ?? "Creative Moment"}
          </h1>
          {data.description && (
            <p className="text-lg text-muted-foreground">{data.description}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">

        {/* A projection is the Creative Moment's audience-facing representation. */}
        {data.projection_id ? (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Moment Card</h2>
            <MomentCard
              projectionId={data.projection_id}
              title={data.title}
              typeLabel="Creative Moment representation"
              hasMedia={false}
              collectible={false}
            />
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">No Moment Card representation yet.</p>
        )}

        <Separator />

      </div>
    </div>
  );
}

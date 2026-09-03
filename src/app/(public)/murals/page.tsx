export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import ArtworkFrame from "@/components/artwork-frame";

type MuralItem = {
  master_id: string;
  title: string | null;
  artist: string | null;
};

async function getData(): Promise<MuralItem[]> {
  const svc = getServiceClient();

  const { data: masters } = await svc
    .from("master")
    .select("master_id, attribution_ref")
    .eq("canonical_type", "mural")
    .not("current_state_id", "is", null)
    .order("created_at", { ascending: false });

  if (!masters?.length) return [];

  const ids = masters.map((m) => m.master_id);
  const attrIds = masters.map((m) => m.attribution_ref).filter(Boolean);

  const [{ data: presentations }, { data: attrEntries }] = await Promise.all([
    svc.from("work_presentation").select("master_id, title").in("master_id", ids),
    attrIds.length
      ? svc.from("attribution_entry").select("attribution_id, role_type").in("attribution_id", attrIds).eq("public", true)
      : Promise.resolve({ data: [] }),
  ]);

  return masters.map((m) => ({
    master_id: m.master_id,
    title: (presentations ?? []).find((p) => p.master_id === m.master_id)?.title ?? null,
    artist: (attrEntries ?? []).find((e) => e.attribution_id === m.attribution_ref)?.role_type?.replace(/-/g, " ") ?? null,
  }));
}

export default async function MuralsPage() {
  const murals = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/murals" />
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display, inherit)" }}>
            Mural Gallery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Explore all animated murals.</p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        {murals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {murals.map((m) => (
              <Link key={m.master_id} href={`/worlds/${m.master_id}`} className="group space-y-2">
                <ArtworkFrame artworkUrl={null} alt={m.title ?? ""} aspectRatio="16/9" />
                <div>
                  <p className="text-sm font-medium text-foreground truncate group-hover:opacity-70 transition-opacity" style={{ fontFamily: "var(--font-display, inherit)" }}>
                    {m.title ?? "Untitled"}
                  </p>
                  {m.artist && <p className="text-xs text-muted-foreground truncate capitalize">{m.artist}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No murals yet.</p>
        )}
      </div>
    </main>
  );
}

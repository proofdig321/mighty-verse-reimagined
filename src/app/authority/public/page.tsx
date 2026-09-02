export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServiceClient } from "@/lib/authority/validate";
import PageTopNav from "@/components/page-top-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type ProvenanceRow = {
  record_id: string;
  relationship_type: string;
  subject_type: string;
  integrity_hash: string;
  created_at: string;
};

async function getData(): Promise<ProvenanceRow[]> {
  const svc = getServiceClient();
  const { data } = await svc
    .from("provenance_record")
    .select("record_id, relationship_type, subject_type, integrity_hash, created_at")
    .eq("public", true)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    record_id: r.record_id,
    relationship_type: r.relationship_type,
    subject_type: r.subject_type,
    integrity_hash: r.integrity_hash,
    created_at: r.created_at,
  }));
}

const INFO_BLOCKS = [
  { icon: "📋", label: "Notices", sub: "Official notices and publications" },
  { icon: "🔏", label: "Proof of Publication", sub: "Verify authenticity and publication records" },
  { icon: "👥", label: "Participants", sub: "Contributors and creators" },
  { icon: "⬡", label: "Governance", sub: "Rules, policies and frameworks" },
];

export default async function AuthorityPublicPage() {
  const records = await getData();

  return (
    <main className="min-h-screen bg-background">
      <PageTopNav activePath="/authority/public" />
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">

        <div className="space-y-2">
          <h1
            className="text-3xl font-semibold text-foreground"
            style={{ fontFamily: "var(--font-display, inherit)" }}
          >
            Authority
          </h1>
          <p className="text-sm text-muted-foreground">
            Governance, rights and proof of publication for the Mighty Verse.
          </p>
        </div>

        {/* Info blocks */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {INFO_BLOCKS.map(({ icon, label, sub }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-4 py-4 space-y-2">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <Link href="/authority">
          <Button variant="outline">Learn More</Button>
        </Link>

        {/* Public provenance records */}
        {records.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Public Provenance Records
              </p>
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.record_id}
                    className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg text-xs"
                  >
                    <span className="text-muted-foreground w-28 shrink-0 capitalize">
                      {r.relationship_type.replace(/-/g, " ")}
                    </span>
                    <span className="text-muted-foreground w-24 shrink-0 capitalize">
                      {r.subject_type.replace(/-/g, " ")}
                    </span>
                    <span className="text-muted-foreground font-mono truncate">
                      {r.integrity_hash.slice(0, 16)}…
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

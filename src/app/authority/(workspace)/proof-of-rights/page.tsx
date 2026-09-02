export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";

type RightsRow = {
  asset_id: string;
  asset_type: string | null;
  storage_ref: string;
  rights_holder_ref: string | null;
  rights_basis: string | null;
  work_title: string | null;
  projection_id: string | null;
};

async function getData(): Promise<RightsRow[]> {
  const svc = getServiceClient();

  // All bindings with their media asset rights fields
  const { data: bindings } = await svc
    .from("projection_media_binding")
    .select("asset_id, projection_id, media_asset:asset_id(asset_id, asset_type, storage_ref, rights_holder_ref, rights_basis)")
    .not("asset_id", "is", null);

  if (!bindings?.length) return [];

  // Projection presentations for work title
  const projIds = [...new Set(bindings.map((b) => b.projection_id).filter(Boolean))];
  const { data: presentations } = await svc
    .from("projection_presentation")
    .select("projection_id, title")
    .in("projection_id", projIds);

  return bindings
    .filter((b) => {
      const asset = b.media_asset as unknown as { storage_ref: string } | null;
      return asset && !asset.storage_ref?.startsWith("seed:placeholder:");
    })
    .map((b) => {
      const asset = b.media_asset as unknown as { asset_id: string; asset_type: string | null; storage_ref: string; rights_holder_ref: string | null; rights_basis: string | null };
      const pres = (presentations ?? []).find((p) => p.projection_id === b.projection_id);
      return {
        asset_id: asset.asset_id,
        asset_type: asset.asset_type ?? null,
        storage_ref: asset.storage_ref,
        rights_holder_ref: asset.rights_holder_ref ?? null,
        rights_basis: asset.rights_basis ?? null,
        work_title: pres?.title ?? null,
        projection_id: b.projection_id ?? null,
      };
    });
}

export default async function ProofOfRightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const participantId = await getParticipantId(supabase);
  if (!participantId) redirect("/auth/sign-in");

  const rows = await getData();
  const verified = rows.filter((r) => r.rights_holder_ref && r.rights_basis);
  const unverified = rows.filter((r) => !r.rights_holder_ref || !r.rights_basis);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Proof of Rights</h1>
        <p className="text-sm text-muted-foreground">
          Rights and provenance state for media assets in the operational scope.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-3 rounded-lg overflow-hidden border border-border bg-border">
        {[
          { label: "Total Assets", value: rows.length },
          { label: "Rights on File", value: verified.length },
          { label: "Needs Review", value: unverified.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media assets found in the operational scope.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Work</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rights Holder</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Basis</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isVerified = !!(r.rights_holder_ref && r.rights_basis);
                return (
                  <tr key={r.asset_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.work_title ?? <span className="text-muted-foreground italic">void</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {r.asset_type ?? <span className="italic">void</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {r.rights_holder_ref
                        ? r.rights_holder_ref.slice(0, 8) + "…"
                        : <span className="not-italic font-sans italic">void</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {r.rights_basis ?? <span className="italic">void</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isVerified
                        ? <span className="text-xs text-green-400">Rights on file</span>
                        : <span className="text-xs text-amber-400">Needs review</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

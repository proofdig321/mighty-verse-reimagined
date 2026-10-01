export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { formatIsrcDisplay, ISRC_STATUS_LABELS, recordingCategory, RECORDING_CATEGORY_LABELS } from "@/lib/media/isrc";
import { IsrcRegistrantForm } from "./isrc-registrant-form";

async function getData() {
  const svc = getServiceClient();

  const [{ data: registrants }, { data: realizations }] = await Promise.all([
    svc
      .from("isrc_registrant")
      .select("registrant_id, registrant_name, country_code, registrant_code, prefix_code, effective_from, active, notes")
      .order("active", { ascending: false })
      .order("effective_from", { ascending: false }),
    svc
      .from("media_realization")
      .select("realization_id, master_id, realization_type, isrc, isrc_status, version_label, rights_holder_ref"),
  ]);

  // Resolve master titles for realizations
  const masterIds = [...new Set((realizations ?? []).map((r) => r.master_id).filter(Boolean))];
  const { data: presentations } = masterIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", masterIds)
    : { data: [] };

  return {
    registrants: registrants ?? [],
    realizations: (realizations ?? []).map((r) => ({
      ...r,
      masterTitle: (presentations ?? []).find((p) => p.master_id === r.master_id)?.title ?? null,
    })),
  };
}

export default async function IsrcPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const { registrants, realizations } = await getData();
  const activeRegistrant = registrants.find((r) => r.active) ?? null;

  const eligible = realizations.filter((r) => recordingCategory(r.realization_type) !== "other");
  const assigned = eligible.filter((r) => r.isrc);
  const pending = eligible.filter((r) => !r.isrc && r.rights_holder_ref);
  const blocked = eligible.filter((r) => !r.isrc && !r.rights_holder_ref);

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority · Rights</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">ISRC</h1>
        <p className="text-sm text-muted-foreground">
          Recording identity. Each eligible realization carries its own ISRC — never shared across recordings.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 rounded-lg overflow-hidden border border-border bg-border">
        {[
          { label: "Eligible Recordings", value: eligible.length },
          { label: "ISRC Assigned", value: assigned.length },
          { label: "Rights on File", value: pending.length },
          { label: "Rights Missing", value: blocked.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Registrant configuration */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Registrant Configuration</p>
        {activeRegistrant ? (
          <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">{activeRegistrant.registrant_name}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Active</span>
            </div>
            <dl className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Prefix</dt><dd className="font-mono text-foreground">{activeRegistrant.prefix_code}</dd></div>
              {activeRegistrant.country_code && <div><dt className="text-muted-foreground">Country</dt><dd className="text-foreground">{activeRegistrant.country_code}</dd></div>}
              {activeRegistrant.registrant_code && <div><dt className="text-muted-foreground">Registrant code</dt><dd className="font-mono text-foreground">{activeRegistrant.registrant_code}</dd></div>}
              <div><dt className="text-muted-foreground">Effective from</dt><dd className="text-foreground">{activeRegistrant.effective_from}</dd></div>
            </dl>
            {activeRegistrant.notes && (
              <p className="text-xs text-muted-foreground">{activeRegistrant.notes}</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-amber-400">No ISRC registrant configured</p>
            <p className="text-xs text-muted-foreground">
              ISRC assignment is blocked until an authorized prefix is configured.
              Obtain a registrant code from the national ISRC Agency before proceeding.
              Do not use a placeholder prefix.
            </p>
          </div>
        )}
        <IsrcRegistrantForm />
      </div>

      {/* Realization ISRC status */}
      {eligible.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recording Realizations</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recording</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Category</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ISRC</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Rights</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eligible.map((r) => {
                  const cat = recordingCategory(r.realization_type);
                  const statusLabel = ISRC_STATUS_LABELS[r.isrc_status as keyof typeof ISRC_STATUS_LABELS] ?? r.isrc_status;
                  const hasRights = !!r.rights_holder_ref;
                  return (
                    <tr key={r.realization_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.version_label ?? r.masterTitle ?? <span className="italic text-muted-foreground">Untitled</span>}</p>
                        {r.masterTitle && r.version_label && (
                          <p className="text-xs text-muted-foreground">{r.masterTitle}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {RECORDING_CATEGORY_LABELS[cat] ?? cat}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {r.isrc ? formatIsrcDisplay(r.isrc) : <span className="font-sans italic text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          r.isrc_status === "verified" ? "bg-emerald-500/15 text-emerald-400" :
                          r.isrc_status === "assigned" ? "bg-violet-500/15 text-violet-400" :
                          r.isrc_status === "assignment-required" ? "bg-amber-500/10 text-amber-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {hasRights
                          ? <span className="text-xs text-emerald-400">On file</span>
                          : <span className="text-xs text-amber-400">Missing</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical registrants */}
      {registrants.length > 1 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Registrant History</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Prefix</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Effective</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {registrants.map((r) => (
                  <tr key={r.registrant_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-foreground">{r.registrant_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{r.prefix_code}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.effective_from}</td>
                    <td className="px-4 py-3">
                      {r.active
                        ? <span className="text-xs text-emerald-400">Active</span>
                        : <span className="text-xs text-muted-foreground/50">Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

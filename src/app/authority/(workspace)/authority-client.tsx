"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  api, shortId, operatorError,
  WORK_TYPE_LABELS, EXPERIENCE_TYPE_LABELS,
  getWorkStatus, type WorkStatus,
} from "./_shared/authority-utils";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; parent_master_id: string | null; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string; start_ms: number | null; end_ms: number | null; realization_id: string | null; media_asset: { storage_ref: string; asset_type: string; rights_holder_ref: string | null; rights_basis: string | null } | null }[];
  presentations: { master_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  projectionPresentations: { projection_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null }[];
  realizations: { realization_id: string; master_id: string; realization_type: string; rights_holder_ref: string | null; rights_basis: string | null; production_notes: string | null }[];
  participants: { participant_id: string; label: string }[];
  mediaAssets: { asset_id: string; asset_type: string; storage_ref: string; format: string | null; duration_ms: number | null; created_at: string; title: string | null; master_id: string | null }[];
};

type WorkRecord = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  status: WorkStatus;
};

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    api("/api/authority").then(d => {
      if (d.error) setError(d.error);
      else setData(d);
    });
  }, []);

  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;

  const { authority, masters, states, projections, bindings, presentations, projectionPresentations, realizations } = data;

  const workRecords: WorkRecord[] = masters.map(master => {
    const state = states.find(s => s.master_id === master.master_id);
    const projection = projections.find(p => p.master_id === master.master_id);
    const binding = projection ? bindings.find(b => b.projection_id === projection.projection_id) : undefined;
    const presentation = presentations.find(p => p.master_id === master.master_id);
    const projectionPresentation = projection ? projectionPresentations.find(p => p.projection_id === projection.projection_id) : undefined;
    return { master, state, projection, binding, presentation, projectionPresentation, status: getWorkStatus(master, state, projection, binding, presentation, projectionPresentation, realizations) };
  });

  const titleFor = (r: WorkRecord) => r.presentation?.title ?? r.projectionPresentation?.title ?? "Untitled work";
  const homeRoot = workRecords.find(r => r.master.parent_master_id === null && r.master.canonical_type === "universe" && !!r.presentation?.title);
  const homeIds = new Set<string>(homeRoot ? [homeRoot.master.master_id] : workRecords.map(r => r.master.master_id));
  if (homeRoot) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of workRecords) {
        if (r.master.parent_master_id && homeIds.has(r.master.parent_master_id) && !homeIds.has(r.master.master_id)) {
          homeIds.add(r.master.master_id);
          changed = true;
        }
      }
    }
  }
  const operationalRecords = workRecords.filter(r => homeIds.has(r.master.master_id));

  const attention = operationalRecords.flatMap(record => {
    const issues: { record: WorkRecord; label: string; detail: string; action: string }[] = [];
    const name = titleFor(record);
    if (!record.status.hasState) issues.push({ record, label: "Needs authorisation", detail: `${name} is registered but has not been authorised for publishing.`, action: "Authorise work" });
    else if (!record.status.hasExperience) issues.push({ record, label: "Needs experience", detail: `${name} has an authorised identity but no publishing experience.`, action: "Create experience" });
    else if (record.master.canonical_type !== "creative-moment" && !record.status.playable) issues.push({ record, label: "Video", detail: `${name} needs a playable video to continue publishing.`, action: "Add video" });
    if (record.status.needsTimeline && record.status.hasMedia) issues.push({ record, label: "Timeline", detail: `${name} needs a playback range before it can be reviewed.`, action: "Set timeline" });
    if (record.master.canonical_type === "scene" && record.status.playable && !record.status.needsTimeline && !record.status.hasRealization) issues.push({ record, label: "Production version", detail: `${name} has playable media and a complete timeline, but its production version has not been recorded.`, action: "Record production version" });
    return issues;
  });

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mighty Verse</span><ChevronRight size={13} /><span>Authority</span></div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{authority.scope_type} scope</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card className="border-0 shadow-sm"><CardContent className="space-y-4 pt-5">
          <div className="flex items-start justify-between">
            <div><h2 className="text-base font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">The next useful action for incomplete work.</p></div>
            <Badge variant="outline">{attention.length} items</Badge>
          </div>
          {attention.length === 0
            ? <p className="border-t border-border pt-4 text-sm text-muted-foreground">Everything in the catalogue is ready for review.</p>
            : <div className="divide-y divide-border">{attention.slice(0, 6).map((item, index) => (
                <div key={`${item.record.master.master_id}-${item.label}-${index}`} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{titleFor(item.record)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant="outline">{WORK_TYPE_LABELS[item.record.master.canonical_type]}</Badge><span className="text-xs text-muted-foreground">{item.label}</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/authority/${item.record.master.master_id}`)}>{item.action}</Button>
                </div>
              ))}</div>
          }
        </CardContent></Card>

        <Card className="border-0 bg-primary text-primary-foreground shadow-sm"><CardContent className="space-y-5 pt-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Publishing readiness</p>
            <p className="mt-2 text-4xl font-semibold">{operationalRecords.length ? Math.round(operationalRecords.filter(r => r.status.ready).length / operationalRecords.length * 100) : 0}%</p>
            <p className="mt-1 text-sm text-primary-foreground/70">{operationalRecords.filter(r => r.status.ready).length} of {operationalRecords.length} works ready to publish</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full bg-accent-mv transition-all" style={{ width: `${operationalRecords.length ? operationalRecords.filter(r => r.status.ready).length / operationalRecords.length * 100 : 0}%` }} /></div>
          <p className="text-xs text-primary-foreground/60">Readiness is calculated from the live catalogue.</p>
        </CardContent></Card>
      </section>

      <details id="canonical" className="group space-y-4">
        <summary className="cursor-pointer list-none text-foreground text-sm font-medium">
          <span className="mr-2 text-muted-foreground group-open:hidden">+</span>
          <span className="mr-2 text-muted-foreground hidden group-open:inline">−</span>
          View canonical record
          <span className="block pl-5 text-muted-foreground text-xs font-normal">Technical verification of the canonical chain.</span>
        </summary>
        {masters.length === 0 && <p className="text-muted-foreground text-xs">No records yet.</p>}
        {masters.map(m => {
          const mStates = states.filter(s => s.master_id === m.master_id);
          const mProjs = projections.filter(p => p.master_id === m.master_id);
          const typeLabel = WORK_TYPE_LABELS[m.canonical_type] ?? m.canonical_type;
          return (
            <Card key={m.master_id}><CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2"><Badge variant="outline">{typeLabel}</Badge><span className="text-muted-foreground font-mono text-xs" title={m.master_id}>{shortId(m.master_id)}…</span></div>
              {mStates.length === 0 && <p className="text-muted-foreground text-xs pl-4">No authorised state.</p>}
              {mStates.map(s => (
                <div key={s.canonical_state_id} className="pl-4 border-l border-border space-y-1">
                  <div className="flex items-center gap-2"><Badge variant="secondary">v{s.version}</Badge><Badge variant="outline">{s.authorisation_state}</Badge><span className="text-muted-foreground font-mono text-xs" title={s.canonical_state_id}>{shortId(s.canonical_state_id)}…</span></div>
                  {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                    const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                    return (
                      <div key={p.projection_id} className="pl-4 border-l border-border space-y-1">
                        <div className="flex items-center gap-2 flex-wrap"><Badge>{EXPERIENCE_TYPE_LABELS[p.projection_type] ?? p.projection_type}</Badge>{p.collectible_designated && <Badge variant="secondary">collectible</Badge>}<span className="text-muted-foreground font-mono text-xs" title={p.projection_id}>{shortId(p.projection_id)}…</span></div>
                        {pBindings.length === 0 && <p className="text-muted-foreground text-xs pl-4">No media.</p>}
                        {pBindings.map(b => <div key={b.binding_id} className="pl-4 flex items-center gap-2"><Badge variant="outline">{b.binding_type}</Badge><Badge variant="outline">{b.access_level}</Badge><span className="text-muted-foreground font-mono text-xs" title={b.asset_id}>{shortId(b.asset_id)}…</span></div>)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent></Card>
          );
        })}
      </details>
    </div>
  );
}

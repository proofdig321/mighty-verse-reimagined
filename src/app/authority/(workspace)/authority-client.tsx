"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  api, shortId, WORK_TYPE_LABELS, EXPERIENCE_TYPE_LABELS,
  getWorkStatus, getJourneySteps, type WorkStatus, type JourneyStep, type AuthorityData,
} from "./_shared/authority-utils";

// AuthorityData is imported from authority-utils — single canonical definition.

type WorkRecord = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  status: WorkStatus;
};

// ─── Aggregate journey legend ─────────────────────────────────────────────────

function AggregateJourney({ records }: { records: WorkRecord[] }) {
  // For each journey step, count how many operational records have it complete
  const steps = ["Authorised", "Experience", "Media", "Rights", "Artwork", "Timeline", "Production version", "Ready"];
  const counts = steps.map(label => {
    const n = records.filter(r => {
      const j = getJourneySteps(r.master, r.status);
      const step = j.find(s => s.label === label);
      return step?.state === "complete";
    }).length;
    return { label, n, total: records.length };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Publishing Journey</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Move each work from canonical record to publishable experience.</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{records.filter(r => r.status.ready).length}/{records.length} ready</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {counts.map((s, i) => {
          const allDone = s.n === s.total && s.total > 0;
          const noneDone = s.n === 0;
          return (
            <div key={s.label} className={`rounded-lg border p-3 ${allDone ? "border-emerald-500/40 bg-emerald-500/10" : noneDone ? "border-border bg-card/40" : "border-amber-500/40 bg-amber-500/10"}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${allDone ? "bg-emerald-500 text-emerald-950" : noneDone ? "bg-muted text-muted-foreground" : "bg-amber-500 text-amber-950"}`}>{i + 1}</span>
                <span className={`text-xs font-semibold ${allDone ? "text-emerald-400" : noneDone ? "text-muted-foreground/50" : "text-amber-400"}`}>{s.n}/{s.total}</span>
              </div>
              <p className="min-h-8 text-xs font-medium leading-tight text-foreground">{s.label}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${allDone ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${s.total ? (s.n / s.total) * 100 : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── IsrcRegistrantSection ────────────────────────────────────────────────────

type Registrant = {
  registrant_id: string;
  registrant_name: string;
  prefix_code: string;
  country_code: string | null;
  registrant_code: string | null;
  effective_from: string;
  active: boolean;
  notes: string | null;
};

function IsrcRegistrantSection() {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/authority/isrc/registrant")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setRegistrants(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function submit() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/authority/isrc/registrant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrant_name: name.trim(), prefix_code: prefix.trim().toUpperCase(), notes: notes.trim() || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "Failed to add registrant"); return; }
    setRegistrants(prev => [data, ...prev]);
    setName(""); setPrefix(""); setNotes(""); setAdding(false);
  }

  const active = registrants.find(r => r.active);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">ISRC Registrant</p>
          <p className="mt-1 text-xs text-muted-foreground/70">The active prefix used for ISRC assignment. Required before any ISRC can be assigned.</p>
        </div>
        {!adding && (
          <div className="flex items-center gap-3">
            <button onClick={() => { setAdding(true); setMsg(null); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              + Configure prefix
            </button>
            {!active && (
              <button
                onClick={async () => {
                  setBusy(true); setMsg(null);
                  const res = await fetch("/api/authority/isrc/seed", { method: "POST" });
                  const d = await res.json();
                  setBusy(false);
                  if (d.seeded) {
                    setRegistrants(prev => [d.registrant, ...prev]);
                    setMsg(null);
                  } else {
                    setMsg(d.reason ?? d.error ?? "Seed failed");
                  }
                }}
                disabled={busy}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                Seed from env
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
      ) : active ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-foreground tracking-widest">{active.prefix_code}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Active</span>
          </div>
          <p className="text-xs text-muted-foreground">{active.registrant_name}</p>
          {active.notes && <p className="text-xs text-muted-foreground/60">{active.notes}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400">No active ISRC prefix configured</p>
          <p className="text-xs text-muted-foreground mt-1">ISRC assignment is blocked until a registrant prefix is configured.</p>
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-border bg-card/60 px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Add ISRC Registrant</p>
          <input
            value={name} onChange={e => setName(e.target.value)} placeholder="Registrant name *"
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} placeholder="Prefix code (e.g. ZAXYZ) *"
            maxLength={5}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm font-mono"
          />
          <p className="text-[10px] text-muted-foreground/60">5 characters: 2-letter country code + 3-character registrant code. Assigned by your national ISRC agency.</p>
          <input
            value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
          />
          {msg && <p className="text-xs text-destructive">{msg}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit} disabled={busy || !name.trim() || prefix.length !== 5}
              className="px-3 py-1.5 text-xs rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold transition-colors"
            >
              {busy ? "Saving…" : "Save registrant"}
            </button>
            <button onClick={() => { setAdding(false); setMsg(null); }} className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {registrants.length > 1 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors select-none">
            <span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span> All registrants ({registrants.length})
          </summary>
          <div className="mt-2 space-y-1">
            {registrants.map(r => (
              <div key={r.registrant_id} className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">{r.prefix_code}</span>
                <span>{r.registrant_name}</span>
                {r.active && <span className="text-emerald-400">active</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

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
  if (!data) return <p className="text-muted-foreground p-6 text-sm animate-pulse">Loading…</p>;

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
  const readyCount = operationalRecords.filter(r => r.status.ready).length;
  const readinessPct = operationalRecords.length ? Math.round(readyCount / operationalRecords.length * 100) : 0;

  const attention = operationalRecords.flatMap(record => {
    const issues: { record: WorkRecord; label: string; action: string }[] = [];
    const name = titleFor(record);
    if (!record.status.hasState) issues.push({ record, label: "Needs authorisation", action: "Authorise work" });
    else if (!record.status.hasExperience) issues.push({ record, label: "Needs experience", action: "Create experience" });
    else if (record.master.canonical_type !== "creative-moment" && !record.status.playable) issues.push({ record, label: "Needs media", action: "Add video" });
    if (record.status.needsTimeline && record.status.hasMedia) issues.push({ record, label: "Needs timeline", action: "Set timeline" });
    if (record.master.canonical_type === "scene" && record.status.playable && !record.status.needsTimeline && !record.status.hasRealization) issues.push({ record, label: "Needs production version", action: "Record production version" });
    return issues;
  });

  return (
    <div className="space-y-12">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {authority.scope_type} scope
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Authority Console</h1>
        <p className="text-sm text-muted-foreground">
          Operational overview of the Mighty Verse production and publishing state.
        </p>
      </div>

      {/* ── State summary ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 rounded-lg overflow-hidden border border-border bg-border">
        {[
          { label: "Needs Attention", value: attention.length, sub: "works require action" },
          { label: "Readiness", value: `${readinessPct}%`, sub: `${readyCount} / ${operationalRecords.length} ready` },
          { label: "Ready", value: readyCount, sub: "works ready to publish" },
          { label: "Operational", value: operationalRecords.length, sub: "works in scope" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card px-5 py-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Publishing journey ───────────────────────────────────────────────── */}
      <AggregateJourney records={operationalRecords} />

      <Separator className="opacity-30" />

      {/* ── Needs attention ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Needs Attention</p>
          <span className="text-xs text-muted-foreground">{attention.length} item{attention.length !== 1 ? "s" : ""}</span>
        </div>

        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">All operational works are ready for review.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Work</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Block</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attention.map((item, i) => (
                  <tr
                    key={`${item.record.master.master_id}-${i}`}
                    className="cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => router.push(`/authority/${item.record.master.master_id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{titleFor(item.record)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{WORK_TYPE_LABELS[item.record.master.canonical_type]}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400/80">{item.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        {item.action} <ChevronRight size={12} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* ── Start publishing ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start publishing</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Bring media into the Mighty Verse workflow, then review its presentation and rights.</p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {[
            { step: "01", label: "Create Work", sub: "Register a new creative work", href: "/authority/create" },
            { step: "02", label: "Media intake", sub: "Identify work and metadata", href: "/authority/media/intake" },
            { step: "03", label: "Rights review", sub: "Confirm provenance", href: "/authority/proof-of-rights" },
          ].map(item => (
            <Link key={item.label} href={item.href} className="group bg-card px-5 py-4 transition-colors hover:bg-accent/30">
              <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">{item.step}</span>
              <p className="mt-2 text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{item.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">Open workflow <ArrowRight size={12} /></span>
            </Link>
          ))}
        </div>
      </section>

      <Separator className="opacity-30" />

      {/* ── Media Library ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Media Library</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Recent media assets in the Golden Shovel catalogue.</p>
          </div>
          <Link href="/authority/media" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
        {data.mediaAssets.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/30 px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">No media assets yet.</p>
            <Link href="/authority/media/intake" className="mt-2 inline-block text-xs text-muted-foreground underline hover:text-foreground">Add media →</Link>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {data.mediaAssets
              .filter(a => !a.storage_ref.startsWith("seed:placeholder:") && !a.storage_ref.startsWith("thumbnail:"))
              .slice(0, 4)
              .map(asset => {
                const intake = data.mediaIntakes?.find((i: { asset_id: string | null }) => i.asset_id === asset.asset_id);
                const hasRights = !!(bindings.find(b => b.asset_id === asset.asset_id)?.media_asset?.rights_holder_ref);
                const thumbUrl = !asset.storage_ref.startsWith("http") && !asset.storage_ref.startsWith("seed:") && !asset.storage_ref.startsWith("thumbnail:")
                  ? `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${asset.storage_ref}/thumbnails/keyframes_0.png`
                  : asset.storage_ref.startsWith("http") && asset.asset_type === "thumbnail"
                  ? asset.storage_ref
                  : null;
                return (
                  <a key={asset.asset_id} href={`/authority/media/${asset.asset_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-14 h-9 rounded bg-muted/40 shrink-0 overflow-hidden flex items-center justify-center">
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">{intake?.work_type ?? asset.asset_type}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {asset.title ?? <span className="font-mono text-xs text-muted-foreground">{asset.storage_ref.slice(0, 14)}…</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {intake?.work_type ?? asset.asset_type}
                        {asset.duration_ms ? ` · ${Math.floor(asset.duration_ms / 60000)}:${String(Math.floor((asset.duration_ms % 60000) / 1000)).padStart(2, "0")}` : ""}
                        {hasRights ? " · Rights ✓" : " · Rights?"}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
                  </a>
                );
              })}
          </div>
        )}
      </section>

      <Separator className="opacity-30" />

      {/* ── Canonical entities ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 rounded-lg overflow-hidden border border-border bg-border">
        {[
          { label: "Universes",        sub: "Top-level canonical containers", href: "/authority/universes" },
          { label: "Murals",           sub: "Canonical Murals",               href: "/authority/murals" },
          { label: "Scenes",           sub: "Canonical Scenes",               href: "/authority/scenes" },
          { label: "Creative Moments", sub: "Canonical Creative Moments",     href: "/authority/creative-moments" },
        ].map(({ label, sub, href }) => (
          <Link key={label} href={href} className="group bg-card px-5 py-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>
            </div>
            <ArrowRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Module handoffs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-px sm:grid-cols-4 rounded-lg overflow-hidden border border-border bg-border">
        {[
          { label: "Media Gallery",   sub: "Audio and video assets",  href: "/authority/media" },
          { label: "Add Media",       sub: "Register new intake",      href: "/authority/media/intake" },
          { label: "Participants",    sub: "People and roles",         href: "/authority/participants" },
          { label: "Proof of Rights", sub: "Rights and provenance",    href: "/authority/proof-of-rights" },
        ].map(({ label, sub, href }) => (
          <Link key={label} href={href} className="group bg-card px-5 py-4 flex items-center justify-between hover:bg-accent/30 transition-colors">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>
            </div>
            <ArrowRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
          </Link>
        ))}
      </div>

      <Separator className="opacity-30" />

      {/* ── ISRC Configuration ───────────────────────────────────────────────── */}
      <IsrcRegistrantSection />

      <Separator className="opacity-30" />

      {/* ── Canonical record ─────────────────────────────────────────────────── */}
      <details id="canonical" className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors select-none">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
          Technical details — Canonical record
        </summary>
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-card/50 p-4">
          {masters.length === 0 && <p className="text-muted-foreground text-xs">No records yet.</p>}
          {masters.map(m => {
            const mStates = states.filter(s => s.master_id === m.master_id);
            const mProjs = projections.filter(p => p.master_id === m.master_id);
            return (
              <div key={m.master_id} className="space-y-1 font-mono text-xs text-muted-foreground">
                <p><span className="text-foreground/60">{WORK_TYPE_LABELS[m.canonical_type] ?? m.canonical_type}</span> {shortId(m.master_id)}…</p>
                {mStates.map(s => (
                  <div key={s.canonical_state_id} className="pl-4 border-l border-border/50">
                    <p>state {shortId(s.canonical_state_id)}… v{s.version} {s.authorisation_state}</p>
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                      const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                      return (
                        <div key={p.projection_id} className="pl-4 border-l border-border/50">
                          <p>proj {shortId(p.projection_id)}… {p.projection_type}{p.collectible_designated ? " collectible" : ""}</p>
                          {pBindings.map(b => <p key={b.binding_id} className="pl-4">binding {shortId(b.asset_id)}… {b.binding_type} {b.access_level}</p>)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </details>

    </div>
  );
}

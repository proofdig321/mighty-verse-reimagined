"use client";

import { useState } from "react";
import type { MetadataConsistencyReport, CanonicalMediaMetadata } from "@/lib/media/metadata-types";
import { formatIsrcDisplay, recordingCategory, RECORDING_CATEGORY_LABELS } from "@/lib/media/isrc";

/** A sibling realization on the same master — shown for context only. */
type SiblingRealization = {
  realization_id: string;
  realization_type: string;
  isrc: string | null;
  version_label: string | null;
};

type Props = {
  assetId: string;
  initialMeta: CanonicalMediaMetadata | null;
  initialReport: MetadataConsistencyReport | null;
  intakeIsrc?: string | null;
  /** Other realizations on the same master, for multi-ISRC display. */
  siblingRealizations?: SiblingRealization[];
};

export function MetadataStatusPanel({ assetId, initialMeta, initialReport, intakeIsrc, siblingRealizations }: Props) {
  const [meta, setMeta] = useState(initialMeta);
  const [report, setReport] = useState(initialReport);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setSyncing(true); setMsg(null);
    const res = await fetch("/api/authority/media/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId }),
    });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) { setMsg(data.error ?? "Sync failed"); return; }
    setMeta(data.meta);
    setReport(data.report);
    setMsg("Portable canonical representation synchronised.");
  }

  const stale = report?.sidecarStale;
  const present = report?.sidecarPresent;
  const consistent = report?.isrcConsistent;

  // ISRC reconciliation across three sources
  const canonicalIsrc = meta?.isrc ?? null;
  const sidecarIsrc = report?.sidecarIsrc ?? null;
  const hasIsrcEvidence = intakeIsrc || sidecarIsrc || canonicalIsrc;

  function isrcReconciliationStatus() {
    if (!hasIsrcEvidence) return null;
    const allMatch =
      (!intakeIsrc || intakeIsrc === canonicalIsrc) &&
      (!sidecarIsrc || sidecarIsrc === canonicalIsrc);
    if (allMatch && canonicalIsrc) return { ok: true, label: "Consistent" };
    if (!canonicalIsrc && (intakeIsrc || sidecarIsrc)) return { ok: false, label: "Evidence only — no canonical ISRC assigned" };
    return { ok: false, label: "Conflict — authority review required" };
  }

  const isrcStatus = isrcReconciliationStatus();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Media Metadata</p>
        <button
          onClick={sync}
          disabled={syncing}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {syncing ? "Syncing…" : "Sync canonical representation"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
        {/* Canonical state */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Canonical State</p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-muted-foreground">Asset ID recorded</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={meta?.mediaRealizationId ? "text-emerald-400" : "text-muted-foreground/40"}>
                {meta?.mediaRealizationId ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">Realization linked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={meta?.rightsHolder ? "text-emerald-400" : "text-amber-400"}>
                {meta?.rightsHolder ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">Rights holder</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={meta?.isrc ? "text-emerald-400" : "text-muted-foreground/40"}>
                {meta?.isrc ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">
                {meta?.isrc
                  ? <>
                      <span className="text-foreground/50 mr-1">
                        {meta.realizationType
                          ? RECORDING_CATEGORY_LABELS[recordingCategory(meta.realizationType)] ?? meta.realizationType
                          : "Recording"}
                      </span>
                      <span className="font-mono">{formatIsrcDisplay(meta.isrc)}</span>
                    </>
                  : "ISRC not yet assigned for this recording"}
              </span>
            </div>
          </div>
        </div>

        {/* Portable canonical representation (sidecar) */}
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Portable Canonical Representation</p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className={present ? "text-emerald-400" : "text-muted-foreground/40"}>
                {present ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">{present ? "Sidecar present" : "Not yet generated"}</span>
            </div>
            {present && (
              <div className="flex items-center gap-2">
                <span className={stale ? "text-amber-400" : "text-emerald-400"}>
                  {stale ? "⚠" : "✓"}
                </span>
                <span className="text-muted-foreground">{stale ? "Stale — sync needed" : "Synchronised with canonical state"}</span>
              </div>
            )}
          </div>
        </div>

        {/* ISRC reconciliation */}
        {hasIsrcEvidence && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ISRC Reconciliation</p>
            <div className="space-y-1 text-xs">
              {intakeIsrc && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground/50 w-20 shrink-0">Intake</span>
                  <span className="font-mono text-foreground/70">{formatIsrcDisplay(intakeIsrc)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50 w-20 shrink-0">Embedded</span>
                <span className="text-muted-foreground/40 italic">Provider-managed — not readable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50 w-20 shrink-0">Sidecar</span>
                <span className={sidecarIsrc ? "font-mono text-foreground/70" : "text-muted-foreground/40 italic"}>
                  {sidecarIsrc ? formatIsrcDisplay(sidecarIsrc) : "None"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50 w-20 shrink-0">Canonical</span>
                <span className={canonicalIsrc ? "font-mono text-foreground" : "text-muted-foreground/40 italic"}>
                  {canonicalIsrc ? formatIsrcDisplay(canonicalIsrc) : "Not assigned"}
                </span>
              </div>
              {isrcStatus && (
                <div className="flex items-center gap-2 pt-1">
                  <span className={isrcStatus.ok ? "text-emerald-400" : "text-amber-400"}>
                    {isrcStatus.ok ? "✓" : "⚠"}
                  </span>
                  <span className="text-muted-foreground">{isrcStatus.label}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consistency check */}
        {report && !hasIsrcEvidence && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Consistency</p>
            <div className="flex items-center gap-2 text-xs">
              <span className={consistent ? "text-emerald-400" : "text-red-400"}>
                {consistent ? "✓" : "✗"}
              </span>
              <span className="text-muted-foreground">
                {consistent
                  ? "Canonical ISRC matches sidecar"
                  : `ISRC mismatch — canonical: ${report.canonicalIsrc ?? "none"}, sidecar: ${report.sidecarIsrc ?? "none"}`}
              </span>
            </div>
          </div>
        )}

        {/* Sibling recording ISRCs — other realizations on the same master */}
        {siblingRealizations && siblingRealizations.length > 0 && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Other Recordings — Same Work
            </p>
            <p className="text-[10px] text-muted-foreground/50 mb-2">
              Each recording has its own ISRC. These are distinct identifiers, not alternatives.
            </p>
            <div className="space-y-1 text-xs">
              {siblingRealizations.map((r) => {
                const cat = RECORDING_CATEGORY_LABELS[recordingCategory(r.realization_type)] ?? r.realization_type;
                return (
                  <div key={r.realization_id} className="flex items-start gap-2">
                    <span className={r.isrc ? "text-emerald-400 mt-0.5" : "text-muted-foreground/40 mt-0.5"}>
                      {r.isrc ? "✓" : "○"}
                    </span>
                    <div>
                      <span className="text-muted-foreground/70">{cat}</span>
                      {r.version_label && (
                        <span className="text-muted-foreground/40 ml-1">({r.version_label})</span>
                      )}
                      <span className="ml-2">
                        {r.isrc
                          ? <span className="font-mono text-foreground/70">{formatIsrcDisplay(r.isrc)}</span>
                          : <span className="text-muted-foreground/40 italic">Not yet assigned</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Embedding note */}
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground/50">
            Each recording realization carries its own ISRC. ISRC is never shared across distinct recordings.
            Native embedding: MP3 (ID3v2) and raster images (XMP) supported on upload.
            Embedded metadata is evidence only and is never automatically promoted to canonical state.
          </p>
        </div>
      </div>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { MetadataConsistencyReport, CanonicalMediaMetadata } from "@/lib/media/metadata-types";
import { formatIsrcDisplay } from "@/lib/media/isrc";

type Props = {
  assetId: string;
  initialMeta: CanonicalMediaMetadata | null;
  initialReport: MetadataConsistencyReport | null;
};

export function MetadataStatusPanel({ assetId, initialMeta, initialReport }: Props) {
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
    setMsg("Sidecar synchronised.");
  }

  const stale = report?.sidecarStale;
  const present = report?.sidecarPresent;
  const consistent = report?.isrcConsistent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Media Metadata</p>
        <button
          onClick={sync}
          disabled={syncing}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {syncing ? "Syncing…" : "Sync sidecar"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
        {/* Canonical */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Canonical</p>
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
                {meta?.isrc ? `ISRC: ${formatIsrcDisplay(meta.isrc)}` : "ISRC not yet assigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Sidecar */}
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Sidecar</p>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className={present ? "text-emerald-400" : "text-muted-foreground/40"}>
                {present ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">{present ? "metadata.json present" : "No sidecar yet"}</span>
            </div>
            {present && (
              <div className="flex items-center gap-2">
                <span className={stale ? "text-amber-400" : "text-emerald-400"}>
                  {stale ? "⚠" : "✓"}
                </span>
                <span className="text-muted-foreground">{stale ? "Stale — sync needed" : "Up to date"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Consistency */}
        {report && (
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

        {/* Embedding note */}
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground/50">
            Native embedding: MP3 (ID3v2) and raster images (XMP) supported on upload.
            Video assets hosted on Livepeer use sidecar only — original bytes are provider-managed.
          </p>
        </div>
      </div>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

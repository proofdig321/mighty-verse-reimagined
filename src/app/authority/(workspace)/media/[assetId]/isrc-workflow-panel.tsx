"use client";

import { useState } from "react";
import { formatIsrcDisplay, ISRC_STATUS_LABELS, RECORDING_CATEGORY_LABELS, recordingCategory, type IsrcStatus } from "@/lib/media/isrc";

type Registrant = {
  registrant_id: string;
  registrant_name: string;
  prefix_code: string;
};

type IsrcWorkflowProps = {
  realizationId: string;
  masterId: string;
  realizationType: string;
  currentIsrc: string | null;
  currentIsrcStatus: IsrcStatus;
  hasRights: boolean;
  recordingTitle: string;
  versionLabel: string | null;
  registrant: Registrant | null;
};

type PreviewData = {
  prefix_code: string;
  year_of_reference: number;
  next_designation: number | null; // null = unknown until allocation
  registrant_name: string;
};

type AssignResult = {
  isrc: string;
  isrc_status: string;
  registrant_name: string;
  prefix_code: string;
  year_of_reference: number;
  designation: number;
  assigned_at: string;
};

export function IsrcWorkflowPanel({
  realizationId,
  masterId,
  realizationType,
  currentIsrc,
  currentIsrcStatus,
  hasRights,
  recordingTitle,
  versionLabel,
  registrant,
}: IsrcWorkflowProps) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "assigning" | "done" | "error">("idle");
  const [result, setResult] = useState<AssignResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveIsrc, setLiveIsrc] = useState<string | null>(currentIsrc);
  const [liveStatus, setLiveStatus] = useState<IsrcStatus>(currentIsrcStatus);

  const category = recordingCategory(realizationType);
  const categoryLabel = RECORDING_CATEGORY_LABELS[category] ?? realizationType;

  // Derive year of reference from current date (assignment year)
  const yearOfReference = new Date().getFullYear() % 100;
  const yearDisplay = String(yearOfReference).padStart(2, "0");

  const preview: PreviewData | null = registrant
    ? {
        prefix_code: registrant.prefix_code,
        year_of_reference: yearOfReference,
        next_designation: null, // allocated atomically at assignment time
        registrant_name: registrant.registrant_name,
      }
    : null;

  async function handleAssign() {
    setPhase("assigning");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/authority/isrc/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realization_id: realizationId, master_id: masterId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Assignment failed");
        setPhase("error");
        return;
      }
      setResult(data as AssignResult);
      setLiveIsrc(data.isrc);
      setLiveStatus("assigned");
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }

  // ── Already has ISRC ──────────────────────────────────────────────────────
  if (liveIsrc) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-foreground tracking-widest">{formatIsrcDisplay(liveIsrc)}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
            liveStatus === "verified" ? "bg-emerald-500/15 text-emerald-400" :
            liveStatus === "assigned" ? "bg-violet-500/15 text-violet-400" :
            "bg-muted text-muted-foreground"
          }`}>
            {ISRC_STATUS_LABELS[liveStatus] ?? liveStatus}
          </span>
        </div>
        {result && (
          <dl className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Registrant</dt><dd className="text-foreground">{result.registrant_name}</dd></div>
            <div><dt className="text-muted-foreground">Designation</dt><dd className="text-foreground font-mono">{String(result.designation).padStart(5, "0")}</dd></div>
            <div><dt className="text-muted-foreground">Assigned</dt><dd className="text-foreground">{new Date(result.assigned_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</dd></div>
          </dl>
        )}
        <p className="text-[10px] text-muted-foreground/50">
          This ISRC permanently identifies this recording. It must not be reused for another recording.
        </p>
      </div>
    );
  }

  // ── Not eligible ──────────────────────────────────────────────────────────
  if (category === "other") {
    return (
      <p className="text-sm text-muted-foreground/60 italic">
        Realization type <span className="text-foreground/60">{realizationType}</span> is not ISRC-eligible.
      </p>
    );
  }

  // ── No rights ─────────────────────────────────────────────────────────────
  if (!hasRights) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-amber-400">ISRC assignment unavailable</p>
        <p className="text-xs text-muted-foreground">
          Mighty Verse cannot establish that the current registrant is authorized to assign an ISRC to this recording.
          Resolve rights/authority information first.
        </p>
      </div>
    );
  }

  // ── No registrant configured ──────────────────────────────────────────────
  if (!registrant) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-amber-400">No ISRC prefix configured</p>
        <p className="text-xs text-muted-foreground">
          Configure the authorized ISRC prefix before assigning ISRCs.
        </p>
      </div>
    );
  }

  // ── Confirm phase ─────────────────────────────────────────────────────────
  if (phase === "confirm") {
    return (
      <div className="rounded-lg border border-border bg-card/60 px-4 py-4 space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confirm ISRC Assignment</p>
        <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Recording</dt><dd className="text-foreground">{recordingTitle}</dd></div>
          <div><dt className="text-muted-foreground">Type</dt><dd className="text-foreground">{categoryLabel}</dd></div>
          {versionLabel && <div><dt className="text-muted-foreground">Version</dt><dd className="text-foreground">{versionLabel}</dd></div>}
          <div><dt className="text-muted-foreground">Registrant</dt><dd className="text-foreground">{preview!.registrant_name}</dd></div>
          <div><dt className="text-muted-foreground">Prefix</dt><dd className="text-foreground font-mono">{preview!.prefix_code}</dd></div>
          <div><dt className="text-muted-foreground">Year of Reference</dt><dd className="text-foreground font-mono">{yearDisplay}</dd></div>
          <div><dt className="text-muted-foreground">Designation</dt><dd className="text-foreground/60 italic text-[10px]">Allocated at assignment</dd></div>
        </dl>
        <p className="text-[10px] text-muted-foreground/60">
          This identifier will permanently identify this recording. It must not be reused for another recording.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setPhase("idle")}
            className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="px-3 py-1.5 text-xs rounded-md bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            Assign ISRC
          </button>
        </div>
      </div>
    );
  }

  // ── Assigning ─────────────────────────────────────────────────────────────
  if (phase === "assigning") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="animate-pulse">●</span> Allocating designation and assigning ISRC…
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-xs font-semibold text-red-400">Assignment failed</p>
          <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
        </div>
        <button
          onClick={() => setPhase("idle")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Idle — show status + action ───────────────────────────────────────────
  const statusLabel = ISRC_STATUS_LABELS[liveStatus] ?? liveStatus;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground/60 italic">Not yet assigned</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
          {statusLabel}
        </span>
      </div>

      {/* Assignment preview */}
      {preview && (
        <div className="rounded-lg border border-border bg-card/40 px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Assign ISRC</p>
          <dl className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Registrant</dt><dd className="text-foreground">{preview.registrant_name}</dd></div>
            <div><dt className="text-muted-foreground">Prefix</dt><dd className="text-foreground font-mono">{preview.prefix_code}</dd></div>
            <div><dt className="text-muted-foreground">Year of Reference</dt><dd className="text-foreground font-mono">{yearDisplay}</dd></div>
            <div><dt className="text-muted-foreground">Next Designation</dt><dd className="text-foreground/60 italic text-[10px]">Allocated at assignment</dd></div>
          </dl>
          <button
            onClick={() => setPhase("confirm")}
            className="mt-1 px-3 py-1.5 text-xs rounded-md bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            Assign New ISRC
          </button>
        </div>
      )}
    </div>
  );
}

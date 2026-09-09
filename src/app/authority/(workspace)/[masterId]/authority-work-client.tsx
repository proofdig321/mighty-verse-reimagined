"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HierarchyBreadcrumb, type HierarchyBreadcrumbItem } from "@/components/assemble/breadcrumb";
import {
  api, responseData, shortId, operatorError,
  WORK_TYPE_LABELS, PROJECTION_TYPES, EXPERIENCE_TYPE_LABELS,
  getWorkStatus, getJourneySteps, getNextAction, formatTimelineMs,
} from "../_shared/authority-utils";
import {
  PresentationPanel, ProjectionPresentationPanel,
  RealizationPanel, CreateExperiencePanel,
  TimelineEditor,
} from "../_shared/authority-panels";

// ─── Types ────────────────────────────────────────────────────────────────────

type Master = { master_id: string; canonical_type: string; parent_master_id: string | null; current_state_id: string | null; created_at: string };
type State = { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string };
type Projection = { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string };
type MediaAsset = { storage_ref: string; asset_type: string; rights_holder_ref: string | null; rights_basis: string | null; provider?: string | null } | null;
type Binding = { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string; start_ms: number | null; end_ms: number | null; realization_id: string | null; media_asset: MediaAsset };
type Presentation = { master_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null } | null;
type ProjPresentation = { projection_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null };
type Realization = { realization_id: string; master_id: string; realization_type: string; rights_holder_ref: string | null; rights_basis: string | null; production_notes: string | null };
type Participant = { participant_id: string; label: string };
type ChildItem = { master_id: string; title: string | null; canonical_type: string };
type UploadSession = {
  session_id: string;
  phase: string;
  provider: string | null;
  asset_id: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  master: Master;
  states: State[];
  projections: Projection[];
  bindings: Binding[];
  presentation: Presentation;
  projectionPresentations: ProjPresentation[];
  realizations: Realization[];
  participants: Participant[];
  parentTitle: string | null;
  parentMasterId: string | null;
  parentCanonicalType: string | null;
  childItems: ChildItem[];
  rightsHolderLabel: string | null;
  intakeId: string | null;
  uploadSessions: UploadSession[];
};

// ─── AttachVideoPanel ─────────────────────────────────────────────────────────

function AttachVideoPanel({ projId, masterId, workTitle, intakeId, participants, onDone, onCancel }: { projId: string; masterId: string; workTitle: string; intakeId?: string | null; participants: Participant[]; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rightsHolderRef, setRightsHolderRef] = useState(participants.find(p => p.participant_id === participants[0]?.participant_id)?.participant_id ?? "");
  const [rightsBasis, setRightsBasis] = useState("owned");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accept video and audio
  const ACCEPTED_TYPES = "video/mp4,video/*,audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/m4a,audio/x-m4a,audio/ogg,audio/opus,audio/*";
  const isAudio = file?.type.startsWith("audio/") || (file?.name && /\.(mp3|wav|flac|aiff|aif|m4a|aac|ogg|opus)$/i.test(file.name));

  function isAcceptedFile(f: File): boolean {
    return f.type.startsWith("video/") || f.type.startsWith("audio/") ||
      /\.(mp4|mov|avi|mkv|webm|mp3|wav|flac|aiff|aif|m4a|aac|ogg|opus)$/i.test(f.name);
  }

  return (
    <Card><CardContent className="pt-4 space-y-4">
      <div className="flex items-center justify-between"><span className="text-foreground text-sm font-medium">Attach Media</span>{!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}</div>

      {/* File drop zone */}
      <div
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center cursor-pointer transition-colors ${file ? "border-[var(--accent-mv)]/60 bg-accent/10" : "border-border hover:border-[var(--accent-mv)]/40"}`}
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && isAcceptedFile(f)) setFile(f); }}
      >
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} disabled={busy} className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <>
            <span className="text-xl">{isAudio ? "🎵" : "🎬"}</span>
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
          </>
        ) : (
          <>
            <span className="text-xl opacity-30">📁</span>
            <p className="text-sm text-muted-foreground">Click or drag a video or audio file here</p>
            <p className="text-xs text-muted-foreground/60">MP4, MOV, MP3, WAV, FLAC, M4A, OGG and more</p>
          </>
        )}
      </div>

      {/* Rights holder dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Rights holder</label>
        <select value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Select rights holder…</option>
          {participants.map(p => <option key={p.participant_id} value={p.participant_id}>{p.label}</option>)}
        </select>
      </div>

      {/* Rights basis */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Rights basis</label>
        <select value={rightsBasis} onChange={e => setRightsBasis(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="owned">Owned — original work, all rights held</option>
          <option value="licensed">Licensed — rights licensed from third party</option>
          <option value="commissioned">Commissioned — work for hire / commissioned</option>
          <option value="co-owned">Co-owned — jointly held rights</option>
          <option value="other">Other</option>
        </select>
      </div>

      {busy && progress !== null && <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "var(--accent-mv)" }} /></div>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
      <Button size="sm" disabled={busy || !file || !rightsHolderRef || !rightsBasis} onClick={async () => {
        if (!file) return;
        setBusy(true); setMsg(null);
        try {
          const session = await api("/api/authority/media/upload-session", { name: file.name, projection_id: projId, master_id: masterId, intake_id: intakeId ?? null });
          if (session.error || !session.upload_url || !session.session_id) throw new Error(session.error ?? "Upload session failed");
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
            xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.open("PUT", session.upload_url);
            xhr.send(file);
          });
          setMsg("Uploading… processing media.");
          let phase = "uploading";
          let outcome: "ingested" | "failed" | "request_timeout" = "request_timeout";
          for (let i = 0; i <= 60; i++) {
            const s = await fetch(`/api/authority/media/upload-session/${session.session_id}`).then(responseData);
            if (s.error) throw new Error(s.error);
            phase = s.phase ?? "unknown";
            if (phase === "ingested" || phase === "ready") { outcome = "ingested"; break; }
            if (phase === "failed") { outcome = "failed"; break; }
            setMsg("Processing video…");
            if (i === 60) break;
            await new Promise(r => setTimeout(r, 5000));
          }
          if (outcome === "failed" || phase === "failed") throw new Error("The media provider reported that processing failed. This work is preserved.");
          if (outcome !== "ingested") {
            const reconcileRes = await fetch("/api/authority/media/reconcile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: session.session_id }),
            });
            const reconcile = await reconcileRes.json().catch(() => ({}));
            if (!(reconcileRes.ok && (reconcile.reconciled || reconcile.already_ingested || reconcile.phase === "ingested"))) {
              setMsg("This page stopped waiting. Processing may still be running. Open this work later to resume — a request timeout is not a processing failure.");
              setBusy(false);
              return;
            }
          }
          const attach = await api("/api/authority/media", { projection_id: projId, master_id: masterId, session_id: session.session_id, rights_holder_ref: rightsHolderRef, rights_basis: rightsBasis, intake_id: intakeId ?? null });
          if (attach.error) throw new Error(attach.error);
          setMsg("Media attached.");
          onDone();
        } catch (err) {
          setMsg(operatorError(err instanceof Error ? err.message : err, { workTitle, operation: "Attach video" }));
        } finally { setBusy(false); }
      }}>Upload &amp; Attach</Button>
    </CardContent></Card>
  );
}

function ResumeMediaPanel({
  session,
  projectionId,
  masterId,
  workTitle,
  participants,
  intakeId,
  bound,
}: {
  session: UploadSession;
  projectionId: string;
  masterId: string;
  workTitle: string;
  participants: Participant[];
  intakeId: string | null;
  bound: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState(session.phase);
  const [rightsHolderRef, setRightsHolderRef] = useState(participants[0]?.participant_id ?? "");
  const [rightsBasis, setRightsBasis] = useState("owned");

  const ingested = phase === "ingested" || phase === "ready";
  const failed = phase === "failed";

  useEffect(() => {
    if (bound && ingested) return;
    if (phase === "ingested" || phase === "ready" || phase === "failed") return;
    void checkStatus();
    // Load live processing state when returning to the work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.session_id]);

  async function checkStatus() {
    setBusy(true);
    setMsg(null);
    try {
      const s = await fetch(`/api/authority/media/upload-session/${session.session_id}`).then(responseData);
      if (s.error) throw new Error(s.error);
      setPhase(s.phase ?? phase);
      if (s.phase === "ingested" || s.phase === "ready") {
        setMsg("Processing complete. Attach this media to the work.");
      } else if (s.phase === "failed") {
        setMsg("The media provider reported that processing failed. Retry attach against this work — do not create a new Universe.");
      } else {
        setMsg("Processing video… You can leave this page and return. A request timeout is not a processing failure.");
      }
    } catch (err) {
      setMsg(operatorError(err instanceof Error ? err.message : err, { workTitle, operation: "Check processing" }));
    } finally {
      setBusy(false);
    }
  }

  async function attachReady() {
    setBusy(true);
    setMsg(null);
    try {
      const attach = await api("/api/authority/media", {
        projection_id: projectionId,
        master_id: masterId,
        session_id: session.session_id,
        rights_holder_ref: rightsHolderRef,
        rights_basis: rightsBasis,
        intake_id: intakeId,
      });
      if (attach.error) throw new Error(attach.error);
      setMsg("Media attached.");
      window.location.reload();
    } catch (err) {
      setMsg(operatorError(err instanceof Error ? err.message : err, { workTitle, operation: "Attach media" }));
      setBusy(false);
    }
  }

  if (bound && ingested) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media processing</p>
      <p className="text-sm text-foreground">
        {failed
          ? "Provider processing failed. Canonical work is preserved."
          : ingested
            ? "Video is processed and ready to attach to this work."
            : "Video processing continues on this work. You can leave and return."}
      </p>
      {!ingested && !failed && (
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--muted)" }}>
          <div className="h-full w-2/5 rounded-full animate-pulse" style={{ background: "var(--accent-mv)" }} />
        </div>
      )}
      {ingested && !bound && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={rightsHolderRef} onChange={(e) => setRightsHolderRef(e.target.value)} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
            {participants.map((p) => (
              <option key={p.participant_id} value={p.participant_id}>{p.label}</option>
            ))}
          </select>
          <select value={rightsBasis} onChange={(e) => setRightsBasis(e.target.value)} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
            <option value="owned">Owned</option>
            <option value="licensed">Licensed</option>
            <option value="commissioned">Commissioned</option>
            <option value="co-owned">Co-owned</option>
          </select>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {!ingested && (
          <Button size="sm" disabled={busy} onClick={() => void checkStatus()}>
            {busy ? "Checking…" : "Check processing"}
          </Button>
        )}
        {ingested && !bound && (
          <Button size="sm" disabled={busy || !rightsHolderRef} onClick={() => void attachReady()}>
            {busy ? "Attaching…" : "Attach media"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthorityWorkClient({
  master, states, projections, bindings, presentation,
  projectionPresentations, realizations, participants,
  parentTitle, parentMasterId, parentCanonicalType, childItems, rightsHolderLabel, intakeId,
  uploadSessions,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [attachingProjId, setAttachingProjId] = useState<string | null>(null);
  const [presentingMaster, setPresentingMaster] = useState(false);
  const [presentingProjId, setPresentingProjId] = useState<string | null>(null);
  const [editingTimelineBindingId, setEditingTimelineBindingId] = useState<string | null>(null);
  const [editingRealizationBindingId, setEditingRealizationBindingId] = useState<string | null>(null);
  const [editingRights, setEditingRights] = useState(false);
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");

  const state = states[0];
  const projection = projections[0];
  const binding = projection ? bindings.find(b => b.projection_id === projection.projection_id) : undefined;
  const projPres = projection ? projectionPresentations.find(p => p.projection_id === projection.projection_id) : undefined;
  const status = getWorkStatus(master, state, projection, binding, presentation, projPres, realizations, master.master_id);

  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
  const title = presentation?.title ?? projPres?.title ?? typeLabel;
  const journey = getJourneySteps(master, status);
  const nextStep = getNextAction(master, status);

  // B5: breadcrumb list page per type
  const listHref: Record<string, string> = {
    universe: "/authority/universes",
    mural: "/authority/murals",
    scene: "/authority/scenes",
    "creative-moment": "/authority/creative-moments",
  };
  const listLabel: Record<string, string> = {
    universe: "Universes",
    mural: "Murals",
    scene: "Scenes",
    "creative-moment": "Creative Moments",
  };
  const parentHref =
    parentMasterId && parentCanonicalType === "universe"
      ? `/authority/universes/${parentMasterId}`
      : parentMasterId
        ? `/authority/${parentMasterId}`
        : null;
  const workspaceHref = master.canonical_type === "universe" ? `/authority/universes/${master.master_id}` : null;

  async function act(label: string, path: string, body: unknown) {
    setBusy(true); setMsg(null);
    const d = await api(path, body);
    setBusy(false);
    if (d.error) { setMsg(operatorError(d.error, { workTitle: title, operation: label })); return; }
    setMsg(`${label} succeeded. Refresh to see updated state.`);
  }

  if (presentingMaster) return <div className="space-y-6"><PresentationPanel masterId={master.master_id} existing={presentation} onDone={() => { setPresentingMaster(false); window.location.reload(); }} onCancel={() => setPresentingMaster(false)} /></div>;
  if (presentingProjId && projection) return <div className="space-y-6"><ProjectionPresentationPanel projectionId={presentingProjId} masterId={master.master_id} existing={projPres} onDone={() => { setPresentingProjId(null); window.location.reload(); }} onCancel={() => setPresentingProjId(null)} /></div>;
  if (attachingProjId && projection) return <div className="space-y-6"><AttachVideoPanel projId={attachingProjId} masterId={master.master_id} workTitle={title} intakeId={intakeId} participants={participants} onDone={() => { setAttachingProjId(null); window.location.reload(); }} onCancel={() => setAttachingProjId(null)} /></div>;
  if (editingTimelineBindingId && binding) return <div className="space-y-6"><TimelineEditor binding={binding} masterId={master.master_id} onDone={() => { setEditingTimelineBindingId(null); window.location.reload(); }} onCancel={() => setEditingTimelineBindingId(null)} /></div>;
  if (editingRealizationBindingId && binding) return <div className="space-y-6"><RealizationPanel bindingId={binding.binding_id} masterId={master.master_id} workTitle={title} participants={participants} onDone={() => { setEditingRealizationBindingId(null); window.location.reload(); }} onCancel={() => setEditingRealizationBindingId(null)} /></div>;

  return (
    <div className="space-y-10">

      {/* B5: Contextual breadcrumb */}
      <HierarchyBreadcrumb
        items={([
          { label: "Authority", href: "/authority" },
          ...(listHref[master.canonical_type]
            ? [{ label: listLabel[master.canonical_type], href: listHref[master.canonical_type] }]
            : []),
          ...(parentHref && parentTitle ? [{ label: parentTitle, href: parentHref }] : []),
          { label: title },
        ] satisfies HierarchyBreadcrumbItem[])}
      />

      {/* Work identity */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{typeLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{status.ready ? "Ready to publish" : status.needs}</p>
        {workspaceHref && (
          <Link href={workspaceHref} className="inline-flex text-xs text-muted-foreground hover:text-foreground transition-colors">
            Open Creative Suite →
          </Link>
        )}
      </div>

      {projection && uploadSessions[0] && (
        <ResumeMediaPanel
          session={uploadSessions[0]}
          projectionId={projection.projection_id}
          masterId={master.master_id}
          workTitle={title}
          participants={participants}
          intakeId={intakeId}
          bound={Boolean(binding)}
        />
      )}

      {/* Six-stage tracker — Media cell respects creative-moment */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(([
          ["Identity",   status.hasState,       false],
          ["Rights",     status.rightsVerified,  false],
          ["Experience", status.hasExperience,   false],
          ["Media",      status.playable,        master.canonical_type === "creative-moment"],
          ["Artwork",    status.hasArtwork,      false],
          ["Timeline",   !status.needsTimeline,  master.canonical_type !== "scene"],
        ] as [string, boolean, boolean][])).map(([label, complete, notApplicable]) => (
          <div key={label} className={`rounded-lg border px-3 py-3 ${notApplicable ? "border-border bg-card/20 opacity-40" : complete ? "border-violet-800/60 bg-violet-950/30" : "border-border bg-card/50"}`}>
            <div className={`mb-2.5 h-0.5 rounded-full ${notApplicable ? "bg-border" : complete ? "bg-violet-500" : "bg-border"}`} />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xs ${notApplicable ? "text-muted-foreground/30" : complete ? "text-violet-400" : "text-muted-foreground/50"}`}>
              {notApplicable ? "N/A" : complete ? "Complete" : "Pending"}
            </p>
          </div>
        ))}
      </div>

      {/* Publishing journey */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Publishing Journey</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Complete each stage to make this work ready to publish.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {journey.map((step, i) => {
            const complete = step.state === "complete";
            const blocked = step.state === "blocked";
            const na = step.state === "not-applicable";
            return (
              <div key={step.label} className={`rounded-lg border p-3 ${na ? "border-border bg-card/20 opacity-40" : complete ? "border-emerald-500/40 bg-emerald-500/10" : blocked ? "border-destructive/40 bg-destructive/10" : "border-border bg-card/40"}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${na ? "bg-muted text-muted-foreground/30" : complete ? "bg-emerald-500 text-emerald-950" : blocked ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${na ? "text-muted-foreground/30" : complete ? "text-emerald-400" : blocked ? "text-destructive" : "text-muted-foreground/60"}`}>{na ? "N/A" : complete ? "Done" : blocked ? "Blocked" : step.state === "current" ? "Next" : "Pending"}</span>
                </div>
                <p className="min-h-8 text-xs font-medium leading-tight text-foreground">{step.label}</p>
              </div>
            );
          })}
        </div>
        {!status.ready && <p className="text-xs text-muted-foreground pt-1"><span className="text-foreground font-medium">Next:</span> {nextStep}</p>}
      </div>

      {/* Overview / Media / Presentation / Rights */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Overview</p>
          <p className="text-sm text-foreground/80">{presentation?.description ?? "No description added yet."}</p>
        </div>
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media</p>
          {/* Scene: show saved timing inline */}
          {master.canonical_type === "scene" && binding && (
            <p className="text-sm font-mono text-foreground/80">
              {binding.start_ms != null && binding.end_ms != null
                ? <>{formatTimelineMs(binding.start_ms)} → {formatTimelineMs(binding.end_ms)}</>
                : <span className="font-sans text-muted-foreground/60 italic">Timeline not set</span>}
            </p>
          )}
          {master.canonical_type !== "scene" && (
            <p className="text-sm text-foreground/80">{status.playable ? "Playable media attached" : "No playable media"}</p>
          )}
          <Button size="sm" variant="outline" disabled={!projection} onClick={() => { if (projection) setAttachingProjId(projection.projection_id); }}>
            {status.playable ? "Replace media" : "Attach media"}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
          {/* Rights: show holder when verified */}
          {status.rightsVerified && binding?.media_asset ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rights</p>
              <p className="text-sm text-foreground">
                {rightsHolderLabel ?? "Recorded, identity unavailable"}
              </p>
              <p className="text-xs text-muted-foreground">{binding.media_asset.rights_basis}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Presentation</p>
              <p className="text-sm text-foreground/80">{status.hasArtwork ? "Artwork ready" : "No artwork"}</p>
              <Button size="sm" variant="outline" onClick={() => setPresentingMaster(true)}>Edit artwork &amp; title</Button>
            </>
          )}
        </div>
      </div>

      {/* B5: Children context — Murals for Universe, Scenes for Mural */}
      {childItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {master.canonical_type === "universe" ? "Murals" : "Scenes"}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/60">{childItems.length}</span>
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {childItems.map(c => (
                  <tr key={c.master_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">
                      {c.title ?? <span className="italic text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/authority/${c.master_id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contextual actions */}
      {status.hasState && !status.hasExperience && state && (
        <CreateExperiencePanel stateId={state.canonical_state_id} masterId={master.master_id} busy={busy} onCreate={(stateId, masterId, type) => act("Create Experience", "/api/authority/projections", { canonical_state_id: stateId, master_id: masterId, projection_type: type })} />
      )}
      {!status.hasState && (
        <Button size="sm" disabled={busy} onClick={() => act("Authorise Work", "/api/authority/states", { master_id: master.master_id })}>
          Authorise work
        </Button>
      )}

      <div className="flex flex-wrap gap-3">
        {status.hasExperience && (
          <button type="button" onClick={() => setPresentingProjId(projection!.projection_id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {projPres ? "Edit moment title" : "Set moment title"}
          </button>
        )}
        {status.rightsVerified && (
          <button type="button" onClick={() => setPresentingMaster(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Edit artwork &amp; title
          </button>
        )}
        {master.canonical_type === "scene" && binding && (
          <button type="button" onClick={() => setEditingTimelineBindingId(binding.binding_id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {binding.start_ms != null && binding.end_ms != null ? "Adjust timeline" : "Set timeline"}
          </button>
        )}
        {master.canonical_type === "scene" && binding && !status.hasRealization && (
          <button type="button" onClick={() => setEditingRealizationBindingId(binding.binding_id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Record realization
          </button>
        )}
        {binding && !status.rightsVerified && !editingRights && (
          <Button size="sm" variant="outline" onClick={() => { setEditingRights(true); setRightsHolderRef(""); setRightsBasis(""); }}>
            Review video rights
          </Button>
        )}
      </div>

      {/* Rights editing */}
      {editingRights && binding && (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
          <p className="text-sm font-medium">{title} — Video rights</p>
          <select value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Select rights owner</option>
            {participants.map(p => <option key={p.participant_id} value={p.participant_id}>{p.label}</option>)}
          </select>
          <input value={rightsBasis} onChange={e => setRightsBasis(e.target.value)} placeholder="Rights basis" className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !rightsHolderRef || !rightsBasis} onClick={async () => {
              setBusy(true); setMsg(null);
              const d = await api("/api/authority/media/rights", { binding_id: binding.binding_id, master_id: master.master_id, rights_holder_ref: rightsHolderRef, rights_basis: rightsBasis });
              setBusy(false);
              if (d.error) { setMsg(operatorError(d.error, { workTitle: title, operation: "Rights update" })); return; }
              setEditingRights(false);
              setMsg("Rights updated. Refresh to see updated state.");
            }}>Save rights</Button>
            <Button size="sm" variant="outline" onClick={() => setEditingRights(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}

      {/* Technical details */}
      <details className="group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors select-none">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
          Technical details
        </summary>
        <div className="mt-3 rounded-lg border border-border bg-card/50 p-4 font-mono text-xs text-muted-foreground space-y-1">
          <p>Master: {shortId(master.master_id)}…</p>
          <p>State: {state ? `${shortId(state.canonical_state_id)}… · v${state.version}` : "None"}</p>
          <p>Experience: {projection ? `${shortId(projection.projection_id)}…` : "None"}</p>
          <p>Media: {binding ? `${shortId(binding.asset_id)}…` : "None"}</p>
          <p>Realization: {binding?.realization_id ? `${shortId(binding.realization_id)}…` : "None"}</p>
        </div>
      </details>

    </div>
  );
}

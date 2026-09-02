"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  api, responseData, shortId, operatorError,
  WORK_TYPE_LABELS, PROJECTION_TYPES, EXPERIENCE_TYPE_LABELS,
  getWorkStatus, getJourneySteps, getNextAction,
} from "../_shared/authority-utils";
import {
  WorkJourney, PresentationPanel, ProjectionPresentationPanel,
  RealizationPanel, CreateExperiencePanel,
} from "../_shared/authority-panels";

// ─── Types ────────────────────────────────────────────────────────────────────

type Master = { master_id: string; canonical_type: string; parent_master_id: string | null; current_state_id: string | null; created_at: string };
type State = { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string };
type Projection = { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string };
type MediaAsset = { storage_ref: string; asset_type: string; rights_holder_ref: string | null; rights_basis: string | null } | null;
type Binding = { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string; start_ms: number | null; end_ms: number | null; realization_id: string | null; media_asset: MediaAsset };
type Presentation = { master_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null } | null;
type ProjPresentation = { projection_id: string; title: string; description: string | null; artwork_asset_id: string | null; artwork_asset: { storage_ref: string } | null };
type Realization = { realization_id: string; master_id: string; realization_type: string; rights_holder_ref: string | null; rights_basis: string | null; production_notes: string | null };
type Participant = { participant_id: string; label: string };

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
};

// ─── AttachVideoPanel (contextual — dashboard version has full staged UX) ─────

function AttachVideoPanel({ projId, masterId, workTitle, onDone, onCancel }: { projId: string; masterId: string; workTitle: string; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card><CardContent className="pt-4 space-y-4">
      <div className="flex items-center justify-between"><span className="text-foreground text-sm font-medium">Attach Video</span>{!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}</div>
      <input value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} placeholder="Rights holder participant ID" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
      <input value={rightsBasis} onChange={e => setRightsBasis(e.target.value)} placeholder="Rights basis (e.g. owned, licensed)" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
      <input type="file" accept="video/mp4,video/*" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm text-muted-foreground" />
      {busy && progress !== null && <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${progress}%` }} /></div>}
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
      <Button size="sm" disabled={busy || !file || !rightsHolderRef || !rightsBasis} onClick={async () => {
        if (!file) return;
        setBusy(true); setMsg(null);
        try {
          const session = await api("/api/authority/media/upload-session", { name: file.name, projection_id: projId, master_id: masterId });
          if (session.error || !session.upload_url || !session.asset_id) throw new Error(session.error ?? "Upload session failed");
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
            xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.open("PUT", session.upload_url);
            xhr.send(file);
          });
          let phase = "uploading";
          for (let i = 0; phase !== "ready" && i < 120; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const s = await fetch(`/api/authority/media/upload-session/${session.asset_id}`).then(responseData);
            if (s.error) throw new Error(s.error);
            phase = s.phase ?? "unknown";
            if (phase === "failed") throw new Error("Livepeer processing failed");
          }
          if (phase !== "ready") throw new Error("Processing timed out");
          const attach = await api("/api/authority/media", { projection_id: projId, master_id: masterId, livepeer_asset_id: session.asset_id, rights_holder_ref: rightsHolderRef, rights_basis: rightsBasis });
          if (attach.error) throw new Error(attach.error);
          setMsg("Video attached.");
          onDone();
        } catch (err) {
          setMsg(operatorError(err instanceof Error ? err.message : err, { workTitle, operation: "Attach video" }));
        } finally { setBusy(false); }
      }}>Upload &amp; Attach</Button>
    </CardContent></Card>
  );
}

// ─── TimelineEditor (contextual — dashboard version has full video player) ────

function TimelineEditor({ binding, masterId, onDone, onCancel }: { binding: Binding; masterId: string; onDone: () => void; onCancel: () => void }) {
  const [startMs, setStartMs] = useState(binding.start_ms ?? 0);
  const [endMs, setEndMs] = useState(binding.end_ms ?? 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card><CardContent className="pt-4 space-y-4">
      <div className="flex items-center justify-between"><span className="text-foreground text-sm font-medium">Set timeline</span>{!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-muted-foreground text-xs">Start (ms)<input type="number" min="0" value={startMs} onChange={e => setStartMs(Number(e.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
        <label className="text-muted-foreground text-xs">End (ms)<input type="number" min="1" value={endMs} onChange={e => setEndMs(Number(e.target.value))} className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1.5 text-sm" /></label>
      </div>
      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
      <Button size="sm" disabled={busy || endMs <= startMs} onClick={async () => {
        setBusy(true); setMsg(null);
        const res = await fetch("/api/authority/media/timeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ binding_id: binding.binding_id, master_id: masterId, start_ms: startMs, end_ms: endMs }) });
        const r = await responseData(res);
        setBusy(false);
        if (!res.ok || r.error) { setMsg(`Error: ${r.error ?? "Save failed"}`); return; }
        onDone();
      }}>Save timeline</Button>
    </CardContent></Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthorityWorkClient({
  master, states, projections, bindings, presentation,
  projectionPresentations, realizations, participants,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Panel state
  const [attachingProjId, setAttachingProjId] = useState<string | null>(null);
  const [presentingMaster, setPresentingMaster] = useState(false);
  const [presentingProjId, setPresentingProjId] = useState<string | null>(null);
  const [editingTimelineBindingId, setEditingTimelineBindingId] = useState<string | null>(null);
  const [editingRealizationBindingId, setEditingRealizationBindingId] = useState<string | null>(null);
  const [editingRights, setEditingRights] = useState(false);
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");

  // Derive work record
  const state = states[0];
  const projection = projections[0];
  const binding = projection ? bindings.find(b => b.projection_id === projection.projection_id) : undefined;
  const projPres = projection ? projectionPresentations.find(p => p.projection_id === projection.projection_id) : undefined;
  const status = getWorkStatus(master, state, projection, binding, presentation, projPres, realizations, master.master_id);

  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;
  const title = presentation?.title ?? projPres?.title ?? typeLabel;
  const statusLabel = status.ready ? "Ready to publish" : status.needs;
  const journey = getJourneySteps(master, status);
  const nextStep = getNextAction(master, status);

  async function act(label: string, path: string, body: unknown) {
    setBusy(true); setMsg(null);
    const d = await api(path, body);
    setBusy(false);
    if (d.error) { setMsg(operatorError(d.error, { workTitle: title, operation: label })); return; }
    setMsg(`${label} succeeded. Refresh to see updated state.`);
  }

  // Active panel — only one open at a time
  if (presentingMaster) {
    return (
      <div className="space-y-6">
        <PresentationPanel masterId={master.master_id} existing={presentation} onDone={() => { setPresentingMaster(false); window.location.reload(); }} onCancel={() => setPresentingMaster(false)} />
      </div>
    );
  }
  if (presentingProjId && projection) {
    return (
      <div className="space-y-6">
        <ProjectionPresentationPanel projectionId={presentingProjId} masterId={master.master_id} existing={projPres} onDone={() => { setPresentingProjId(null); window.location.reload(); }} onCancel={() => setPresentingProjId(null)} />
      </div>
    );
  }
  if (attachingProjId && projection) {
    return (
      <div className="space-y-6">
        <AttachVideoPanel projId={attachingProjId} masterId={master.master_id} workTitle={title} onDone={() => { setAttachingProjId(null); window.location.reload(); }} onCancel={() => setAttachingProjId(null)} />
      </div>
    );
  }
  if (editingTimelineBindingId && binding) {
    return (
      <div className="space-y-6">
        <TimelineEditor binding={binding} masterId={master.master_id} onDone={() => { setEditingTimelineBindingId(null); window.location.reload(); }} onCancel={() => setEditingTimelineBindingId(null)} />
      </div>
    );
  }
  if (editingRealizationBindingId && binding) {
    return (
      <div className="space-y-6">
        <RealizationPanel bindingId={binding.binding_id} masterId={master.master_id} workTitle={title} participants={participants} onDone={() => { setEditingRealizationBindingId(null); window.location.reload(); }} onCancel={() => setEditingRealizationBindingId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/authority" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ChevronRight size={14} className="rotate-180" />
        <span>Catalogue</span>
      </Link>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{typeLabel}</Badge>
              <Badge variant={status.ready ? "secondary" : "outline"}>{statusLabel}</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Work management and publishing journey</p>
          </div>
          {!status.hasState && (
            <Button size="sm" disabled={busy} onClick={() => act("Authorise Work", "/api/authority/states", { master_id: master.master_id })}>
              Authorise work
            </Button>
          )}
        </div>

        {/* Status tiles */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {([["Identity", status.hasState], ["Rights", status.rightsVerified], ["Experience", status.hasExperience], ["Media", status.playable], ["Artwork", status.hasArtwork], ["Timeline", !status.needsTimeline]] as [string, boolean][]).map(([label, complete]) => (
            <div key={label} className={`rounded-md border p-4 ${complete ? "border-accent-mv/50 bg-accent-mv/10" : "border-border"}`}>
              <div className={`mb-2 h-1.5 rounded-full ${complete ? "bg-accent-mv" : "bg-muted"}`} />
              <p className="text-xs font-medium">{label}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{complete ? "Complete" : "Next"}</p>
            </div>
          ))}
        </div>

        {/* Publishing journey */}
        <WorkJourney steps={journey} />
        {!status.ready && <p className="text-xs text-muted-foreground -mt-4"><span className="font-medium text-foreground">Next step:</span> {nextStep}</p>}

        {/* Overview / Media / Presentation cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-0 shadow-sm"><CardContent className="space-y-3 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</p>
            <p className="text-sm">{presentation?.description ?? "No description has been added yet."}</p>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="space-y-3 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media</p>
            <p className="text-sm">{status.playable ? "Playable media attached" : "No playable media attached"}</p>
            <Button size="sm" variant="outline" disabled={!projection} onClick={() => { if (projection) setAttachingProjId(projection.projection_id); }}>
              {status.playable ? "Replace media" : "Attach media"}
            </Button>
          </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="space-y-3 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Presentation</p>
            <p className="text-sm">{status.hasArtwork ? "Artwork ready" : "Artwork not available"}</p>
            <Button size="sm" variant="outline" onClick={() => setPresentingMaster(true)}>Edit artwork &amp; title</Button>
          </CardContent></Card>
        </div>

        {/* Contextual actions */}
        {status.hasState && !status.hasExperience && state && (
          <CreateExperiencePanel stateId={state.canonical_state_id} masterId={master.master_id} busy={busy} onCreate={(stateId, masterId, type) => act("Create Experience", "/api/authority/projections", { canonical_state_id: stateId, master_id: masterId, projection_type: type })} />
        )}

        <div className="flex flex-wrap gap-2">
          {status.hasExperience && (
            <button type="button" onClick={() => setPresentingProjId(projection!.projection_id)} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
              {projPres ? "Edit moment title" : "Set moment title"}
            </button>
          )}
          {master.canonical_type === "scene" && binding && (
            <button type="button" onClick={() => setEditingTimelineBindingId(binding.binding_id)} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
              {binding.start_ms != null && binding.end_ms != null ? "Adjust timeline" : "Set timeline"}
            </button>
          )}
          {master.canonical_type === "scene" && binding && !status.hasRealization && (
            <button type="button" onClick={() => setEditingRealizationBindingId(binding.binding_id)} className="text-muted-foreground text-xs hover:text-foreground transition-colors">
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
          <Card><CardContent className="space-y-3 pt-4">
            <h3 className="text-sm font-semibold">{title} — Video rights</h3>
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
          </CardContent></Card>
        )}

        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}

        {/* Technical details */}
        <Card className="border-0 shadow-sm"><CardContent className="space-y-4 pt-5">
          <div>
            <h3 className="text-sm font-semibold">Technical details</h3>
            <p className="mt-1 text-xs text-muted-foreground">Canonical and verification records for authorised operators.</p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">View canonical record</summary>
            <div className="mt-3 space-y-2 font-mono text-muted-foreground">
              <p>Master: {shortId(master.master_id)}…</p>
              <p>State: {state ? `${shortId(state.canonical_state_id)}… · v${state.version}` : "None"}</p>
              <p>Experience: {projection ? `${shortId(projection.projection_id)}…` : "None"}</p>
              <p>Media: {binding ? `${shortId(binding.asset_id)}…` : "None"}</p>
              <p>Realization: {binding?.realization_id ? `${shortId(binding.realization_id)}…` : "None"}</p>
            </div>
          </details>
        </CardContent></Card>

      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, responseData, PROJECTION_TYPES, EXPERIENCE_TYPE_LABELS, type JourneyStep } from "./authority-utils";

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ label, good = false }: { label: string; good?: boolean }) {
  return <Badge variant={good ? "secondary" : "outline"}>{label}</Badge>;
}

// ─── WorkJourney ─────────────────────────────────────────────────────────────

export function WorkJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-2 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Publishing journey</p>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              {i > 0 && <span className="px-0.5 text-muted-foreground/50">→</span>}
              <span className={`text-xs ${step.state === "complete" ? "text-foreground" : step.state === "blocked" ? "font-medium text-destructive" : step.state === "current" ? "font-medium text-foreground" : "text-muted-foreground/60"}`}>
                {step.state === "complete" ? "✓ " : step.state === "blocked" ? "! " : step.state === "not-applicable" ? "— " : step.state === "optional" ? "· " : "○ "}{step.label}{step.state === "optional" ? " (optional)" : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PresentationPanel ────────────────────────────────────────────────────────

type PresentationPanelProps = {
  masterId: string;
  existing: { title: string; description: string | null; artwork_asset_id?: string | null } | undefined | null;
  onDone: () => void;
  onCancel: () => void;
};

export function PresentationPanel({ masterId, existing, onDone, onCancel }: PresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState(existing?.artwork_asset_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50" />
        <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none" />
        <input type="text" placeholder="Representative artwork asset ID (optional)" value={artworkAssetId} onChange={e => setArtworkAssetId(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button size="sm" disabled={busy || !title.trim()} onClick={async () => {
          setBusy(true); setMsg(null);
          const res = await api("/api/authority/presentation", { master_id: masterId, title, description: description || null, artwork_asset_id: artworkAssetId || null });
          setBusy(false);
          if (res.error) { setMsg(`Error: ${res.error}`); return; }
          onDone();
        }}>Save</Button>
      </CardContent>
    </Card>
  );
}

// ─── ProjectionPresentationPanel ──────────────────────────────────────────────

type ProjectionPresentationPanelProps = {
  projectionId: string;
  masterId: string;
  existing: { title: string; description: string | null; artwork_asset_id?: string | null } | undefined | null;
  onDone: () => void;
  onCancel: () => void;
};

export function ProjectionPresentationPanel({ projectionId, masterId, existing, onDone, onCancel }: ProjectionPresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [artworkAssetId, setArtworkAssetId] = useState(existing?.artwork_asset_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Moment Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50" />
        <textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none" />
        <input type="text" placeholder="Representative artwork asset ID (optional)" value={artworkAssetId} onChange={e => setArtworkAssetId(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button size="sm" disabled={busy || !title.trim()} onClick={async () => {
          setBusy(true); setMsg(null);
          const res = await api("/api/authority/projection-presentation", { projection_id: projectionId, master_id: masterId, title, description: description || null, artwork_asset_id: artworkAssetId || null });
          setBusy(false);
          if (res.error) { setMsg(`Error: ${res.error}`); return; }
          onDone();
        }}>Save</Button>
      </CardContent>
    </Card>
  );
}

// ─── RealizationPanel ─────────────────────────────────────────────────────────

type RealizationPanelProps = {
  bindingId: string;
  masterId: string;
  workTitle: string;
  participants: { participant_id: string; label: string }[];
  onDone: () => void;
  onCancel: () => void;
};

export function RealizationPanel({ bindingId, masterId, workTitle, participants, onDone, onCancel }: RealizationPanelProps) {
  const [type, setType] = useState("animated-video");
  const [rightsHolderRef, setRightsHolderRef] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setMessage(null);
    const created = await api("/api/authority/media-realization", {
      master_id: masterId,
      realization_type: type,
      rights_holder_ref: rightsHolderRef || null,
      rights_basis: rightsBasis || null,
      production_notes: notes || null,
    });
    if (created.error) { setBusy(false); setMessage(`${workTitle} — Production version: ${created.error} Next: select a registered participant.`); return; }
    const bound = await fetch("/api/authority/media-realization/bind", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ binding_id: bindingId, master_id: masterId, realization_id: created.realization_id }),
    }).then(responseData);
    setBusy(false);
    if (bound.error) { setMessage(`${workTitle} — Production version: ${bound.error} Next: verify the selected production details.`); return; }
    onDone();
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-foreground text-sm font-medium block">Record realization</span>
            <span className="text-muted-foreground text-xs">Production context attached to this media binding.</span>
          </div>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <select value={type} onChange={e => setType(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="animated-video">Animated video</option>
          <option value="music-video">Music video</option>
          <option value="original-recording">Original recording</option>
          <option value="visualisation">Visualisation</option>
          <option value="other">Other</option>
        </select>
        <select value={rightsHolderRef} onChange={e => setRightsHolderRef(e.target.value)} disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Select rights owner</option>
          {participants.map(p => <option key={p.participant_id} value={p.participant_id}>{p.label}</option>)}
        </select>
        <input value={rightsBasis} onChange={e => setRightsBasis(e.target.value)} placeholder="Realization rights basis" disabled={busy} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Production context / provenance notes" disabled={busy} rows={3} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none" />
        {message && <p className="text-destructive text-sm">{message}</p>}
        <Button size="sm" disabled={busy || !rightsHolderRef || !rightsBasis} onClick={submit}>Record and associate realization</Button>
      </CardContent>
    </Card>
  );
}

// ─── CreateExperiencePanel ────────────────────────────────────────────────────
// Inline experience-type selector + create button, used in WorkCard and Work Detail.

type CreateExperiencePanelProps = {
  stateId: string;
  masterId: string;
  busy: boolean;
  onCreate: (stateId: string, masterId: string, type: string) => void;
};

export function CreateExperiencePanel({ stateId, masterId, busy, onCreate }: CreateExperiencePanelProps) {
  const [expType, setExpType] = useState("experiential");
  return (
    <div className="space-y-2">
      <select value={expType} onChange={e => setExpType(e.target.value)} className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm">
        {PROJECTION_TYPES.map(t => <option key={t} value={t}>{EXPERIENCE_TYPE_LABELS[t]}</option>)}
      </select>
      <Button size="sm" disabled={busy} onClick={() => onCreate(stateId, masterId, expType)}>Create Experience</Button>
    </div>
  );
}

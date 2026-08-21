"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string }[];
  presentations: { master_id: string; title: string; description: string | null }[];
  projectionPresentations: { projection_id: string; title: string; description: string | null }[];
};

const WORK_TYPE_LABELS: Record<string, string> = {
  "universe": "Universe",
  "creative-moment": "Creative Moment",
  "mural": "Mural",
  "interpretation": "Interpretation",
  "other": "Other",
};

const EXPERIENCE_TYPE_LABELS: Record<string, string> = {
  "experiential": "Experiential",
  "distributional": "Distributional",
  "archival": "Archival",
  "other": "Other",
};

const CANONICAL_TYPES = ["universe", "creative-moment", "mural", "interpretation", "other"] as const;
const PROJECTION_TYPES = ["experiential", "distributional", "archival", "other"] as const;

function shortId(id: string) { return id.slice(0, 8); }

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function Step({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 text-xs font-medium w-4 shrink-0 ${done ? "text-foreground" : "text-muted-foreground"}`}>
        {done ? "✓" : "○"}
      </span>
      <div>
        <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
        {detail && <span className="text-muted-foreground text-xs ml-2">{detail}</span>}
      </div>
    </div>
  );
}

// ─── Work card ───────────────────────────────────────────────────────────────

type WorkCardProps = {
  master: AuthorityData["masters"][number];
  state: AuthorityData["states"][number] | undefined;
  projection: AuthorityData["projections"][number] | undefined;
  binding: AuthorityData["bindings"][number] | undefined;
  presentation: AuthorityData["presentations"][number] | undefined;
  projectionPresentation: AuthorityData["projectionPresentations"][number] | undefined;
  onAuthorise: (masterId: string) => Promise<void>;
  onCreateExperience: (stateId: string, masterId: string, type: string) => Promise<void>;
  onAttachVideo: (projId: string, masterId: string) => void;
  onDesignate: (projId: string, masterId: string) => Promise<void>;
  onEditPresentation: (masterId: string) => void;
  onEditProjectionPresentation: (projId: string, masterId: string) => void;
  busy: boolean;
};

function WorkCard({
  master, state, projection, binding, presentation, projectionPresentation,
  onAuthorise, onCreateExperience, onAttachVideo, onDesignate,
  onEditPresentation, onEditProjectionPresentation,
  busy,
}: WorkCardProps) {
  const [expType, setExpType] = useState("experiential");
  const typeLabel = WORK_TYPE_LABELS[master.canonical_type] ?? master.canonical_type;

  const hasState = !!state;
  const hasProjection = !!projection;
  const hasMedia = !!binding;
  const isCollectible = projection?.collectible_designated ?? false;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 min-w-0">
            <span className="text-foreground text-sm font-medium block truncate">
              {presentation?.title ?? typeLabel}
            </span>
            {presentation?.title && (
              <span className="text-muted-foreground text-xs">{typeLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEditPresentation(master.master_id)}
              className="text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              {presentation ? "Edit title" : "Set title"}
            </button>
            <span className="text-muted-foreground font-mono text-xs cursor-default" title={master.master_id}>{shortId(master.master_id)}…</span>
          </div>
        </div>

        {/* Journey steps */}
        <div className="space-y-1.5">
          <Step done label="Registered" />
          <Step
            done={hasState}
            label={hasState ? "Authorised" : "Needs authorisation"}
            detail={hasState ? `v${state!.version} · ${shortId(state!.canonical_state_id)}…` : undefined}
          />
          {hasState && (
            <Step
              done={hasProjection}
              label={hasProjection ? "Experience created" : "Needs experience"}
              detail={hasProjection ? EXPERIENCE_TYPE_LABELS[projection!.projection_type] ?? projection!.projection_type : undefined}
            />
          )}
          {hasProjection && (
            <Step
              done={hasMedia}
              label={hasMedia ? "Video attached · playable" : "Needs video"}
            />
          )}
          {hasProjection && (
            <Step
              done={isCollectible}
              label={isCollectible ? "Collectible" : "Not yet collectible"}
            />
          )}
        </div>

        {/* Single next action */}
        {!hasState && (
          <Button size="sm" disabled={busy} onClick={() => onAuthorise(master.master_id)}>
            Authorise Work
          </Button>
        )}

        {hasState && !hasProjection && (
          <div className="space-y-2">
            <select
              value={expType}
              onChange={e => setExpType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {PROJECTION_TYPES.map(t => (
                <option key={t} value={t}>{EXPERIENCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <Button size="sm" disabled={busy} onClick={() => onCreateExperience(state!.canonical_state_id, master.master_id, expType)}>
              Create Experience
            </Button>
          </div>
        )}

        {hasProjection && (
          <button
            type="button"
            onClick={() => onEditProjectionPresentation(projection!.projection_id, master.master_id)}
            className="text-muted-foreground text-xs hover:text-foreground transition-colors"
          >
            {projectionPresentation ? "Edit moment title" : "Set moment title"}
          </button>
        )}

        {hasProjection && !hasMedia && (
          <Button size="sm" disabled={busy} onClick={() => onAttachVideo(projection!.projection_id, master.master_id)}>
            Attach Video
          </Button>
        )}

        {hasProjection && hasMedia && !isCollectible && (
          <Button size="sm" disabled={busy} onClick={() => onDesignate(projection!.projection_id, master.master_id)}>
            Designate as Collectible
          </Button>
        )}

        {hasProjection && hasMedia && isCollectible && (
          <p className="text-muted-foreground text-xs">Complete</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Attach Video panel ───────────────────────────────────────────────────────

type AttachVideoPanelProps = {
  projId: string;
  masterId: string;
  onDone: () => void;
  onCancel: () => void;
};

function AttachVideoPanel({ projId, masterId, onDone, onCancel }: AttachVideoPanelProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Attach Video</span>
          {!uploadBusy && (
            <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>
          )}
        </div>

        {/* File picker */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Choose video</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/*"
            disabled={uploadBusy}
            onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadMsg(null); }}
            className="sr-only"
          />
          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors
              ${uploadFile ? "border-border bg-muted/30" : "border-border hover:border-foreground/30 hover:bg-muted/20 cursor-pointer"}
              disabled:pointer-events-none disabled:opacity-50`}
          >
            {uploadFile ? (
              <div className="space-y-0.5">
                <p className="text-foreground text-sm font-medium">{uploadFile.name}</p>
                <p className="text-muted-foreground text-xs">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-foreground text-sm">＋ Choose MP4 video</p>
                <p className="text-muted-foreground text-xs">MP4 · Full video · Uploads directly to Mighty Verse</p>
              </div>
            )}
          </button>
        </div>

        {/* Progress */}
        {uploadBusy && (
          <div className="space-y-2">
            {uploadProgress !== null && uploadProgress < 100 ? (
              <>
                <p className="text-foreground text-sm">Uploading video…</p>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-muted-foreground text-xs">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <p className="text-foreground text-sm">Processing video…</p>
                <p className="text-muted-foreground text-xs">Livepeer is preparing your video for playback.</p>
              </>
            )}
          </div>
        )}

        {uploadMsg && (
          <p className={`text-sm ${uploadMsg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>
            {uploadMsg.startsWith("Error") ? uploadMsg : "✓ " + uploadMsg}
          </p>
        )}

        <Button
          size="sm"
          disabled={uploadBusy || !uploadFile}
          onClick={async () => {
            if (!uploadFile) return;
            setUploadBusy(true); setUploadMsg(null); setUploadProgress(null); setUploadPhase(null);
            try {
              const session = await fetch("/api/authority/media/upload-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: uploadFile.name, projection_id: projId, master_id: masterId }),
              }).then(r => r.json());

              if (session.error) { setUploadMsg(`Error: ${session.error}`); return; }

              const { upload_url, asset_id } = session;

              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.onprogress = e => {
                  if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100));
                };
                xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
                xhr.onerror = () => reject(new Error("Upload network error"));
                xhr.open("PUT", upload_url);
                // Do NOT set Content-Type — Livepeer's pre-signed URL handles it
                xhr.send(uploadFile);
              });

              setUploadProgress(100);

              let phase = "uploading";
              while (phase !== "ready") {
                await new Promise(r => setTimeout(r, 3000));
                const status = await fetch(`/api/authority/media/upload-session/${asset_id}`).then(r => r.json());
                phase = status.phase ?? "unknown";
                setUploadPhase(phase);
                if (phase === "failed") { setUploadMsg("Error: Livepeer processing failed"); return; }
              }

              const attach = await fetch("/api/authority/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projection_id: projId, master_id: masterId, livepeer_asset_id: asset_id }),
              }).then(r => r.json());

              if (attach.error) { setUploadMsg(`Error: ${attach.error}`); return; }
              setUploadMsg("Video attached. World and Moment are now playable.");
              setUploadFile(null); setUploadProgress(null); setUploadPhase(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              onDone();
            } catch (err) {
              setUploadMsg(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
            } finally {
              setUploadBusy(false);
            }
          }}
        >
          Upload & Attach Video
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Presentation panel ───────────────────────────────────────────────────────

type PresentationPanelProps = {
  masterId: string;
  existing: { title: string; description: string | null } | undefined;
  onDone: () => void;
  onCancel: () => void;
};

function PresentationPanel({ masterId, existing, onDone, onCancel }: PresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={busy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true); setMsg(null);
            const res = await api("/api/authority/presentation", { master_id: masterId, title, description: description || null });
            setBusy(false);
            if (res.error) { setMsg(`Error: ${res.error}`); return; }
            onDone();
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Projection presentation panel ───────────────────────────────────────────

type ProjectionPresentationPanelProps = {
  projectionId: string;
  masterId: string;
  existing: { title: string; description: string | null } | undefined;
  onDone: () => void;
  onCancel: () => void;
};

function ProjectionPresentationPanel({ projectionId, masterId, existing, onDone, onCancel }: ProjectionPresentationPanelProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">Moment Presentation</span>
          {!busy && <button type="button" onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={busy}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
            className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
        </div>
        {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}
        <Button
          size="sm"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true); setMsg(null);
            const res = await api("/api/authority/projection-presentation", {
              projection_id: projectionId,
              master_id: masterId,
              title,
              description: description || null,
            });
            setBusy(false);
            if (res.error) { setMsg(`Error: ${res.error}`); return; }
            onDone();
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Register New Work
  const [showRegister, setShowRegister] = useState(false);
  const [canonicalType, setCanonicalType] = useState<string>("universe");

  // Attach Video panel — which projection is currently open
  const [attachingProjId, setAttachingProjId] = useState<string | null>(null);
  const [attachingMasterId, setAttachingMasterId] = useState<string | null>(null);

  // Presentation panel — which master is currently open
  const [presentingMasterId, setPresentingMasterId] = useState<string | null>(null);

  // Projection presentation panel
  const [presentingProjId, setPresentingProjId] = useState<string | null>(null);
  const [presentingProjMasterId, setPresentingProjMasterId] = useState<string | null>(null);

  async function load() {
    const d = await api("/api/authority");
    if (d.error) { setError(d.error); return; }
    setData(d);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(label: string, path: string, body: unknown) {
    setBusy(true); setMsg(null);
    const d = await api(path, body);
    setBusy(false);
    if (d.error) { setMsg(`Error: ${d.error}`); return; }
    setMsg(`${label} succeeded.`);
    await load();
  }

  if (error) return <p className="text-destructive p-6 text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;

  const { authority, masters, states, projections, bindings, presentations, projectionPresentations } = data;

  function getState(masterId: string) {
    return states.find(s => s.master_id === masterId);
  }
  function getProjection(masterId: string) {
    return projections.find(p => p.master_id === masterId);
  }
  function getBinding(projectionId: string) {
    return bindings.find(b => b.projection_id === projectionId);
  }
  function getPresentation(masterId: string) {
    return presentations.find(p => p.master_id === masterId);
  }
  function getProjectionPresentation(projectionId: string) {
    return projectionPresentations.find(p => p.projection_id === projectionId);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">

      {/* Header */}
      <div>
        <h1 className="text-foreground text-lg font-semibold">Authority</h1>
        <p className="text-muted-foreground text-xs">You have full authority over this catalogue.</p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>
      )}

      {/* Register New Work */}
      <div>
        {!showRegister ? (
          <Button size="sm" variant="outline" onClick={() => setShowRegister(true)}>
            + Register New Work
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">Register New Work</span>
                <button type="button" onClick={() => setShowRegister(false)} className="text-muted-foreground text-xs hover:text-foreground">Cancel</button>
              </div>
              <select
                value={canonicalType}
                onChange={e => setCanonicalType(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                {CANONICAL_TYPES.map(t => (
                  <option key={t} value={t}>{WORK_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  await act("Register Work", "/api/authority/masters", { canonical_type: canonicalType });
                  setShowRegister(false);
                }}
              >
                Register Work
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Work cards */}
      {masters.length === 0 && (
        <p className="text-muted-foreground text-sm">No works registered yet. Register your first work above.</p>
      )}

      {masters.map(master => {
        const state = getState(master.master_id);
        const projection = getProjection(master.master_id);
        const binding = projection ? getBinding(projection.projection_id) : undefined;
        const presentation = getPresentation(master.master_id);
        const projectionPresentation = projection ? getProjectionPresentation(projection.projection_id) : undefined;

        // Projection presentation panel open for this projection
        if (presentingProjId === projection?.projection_id) {
          return (
            <ProjectionPresentationPanel
              key={master.master_id}
              projectionId={presentingProjId}
              masterId={presentingProjMasterId!}
              existing={projectionPresentation}
              onDone={async () => { setPresentingProjId(null); setPresentingProjMasterId(null); await load(); }}
              onCancel={() => { setPresentingProjId(null); setPresentingProjMasterId(null); }}
            />
          );
        }

        // Presentation panel open for this master
        if (presentingMasterId === master.master_id) {
          return (
            <PresentationPanel
              key={master.master_id}
              masterId={master.master_id}
              existing={presentation}
              onDone={async () => { setPresentingMasterId(null); await load(); }}
              onCancel={() => setPresentingMasterId(null)}
            />
          );
        }

        // Attach video panel
        if (attachingProjId === projection?.projection_id) {
          return (
            <AttachVideoPanel
              key={master.master_id}
              projId={attachingProjId}
              masterId={attachingMasterId!}
              onDone={async () => { setAttachingProjId(null); setAttachingMasterId(null); await load(); }}
              onCancel={() => { setAttachingProjId(null); setAttachingMasterId(null); }}
            />
          );
        }

        return (
          <WorkCard
            key={master.master_id}
            master={master}
            state={state}
            projection={projection}
            binding={binding}
            presentation={presentation}
            projectionPresentation={projectionPresentation}
            busy={busy}
            onAuthorise={masterId => act("Authorise Work", "/api/authority/states", { master_id: masterId })}
            onCreateExperience={(stateId, masterId, type) =>
              act("Create Experience", "/api/authority/projections", { canonical_state_id: stateId, master_id: masterId, projection_type: type })
            }
            onAttachVideo={(projId, masterId) => { setAttachingProjId(projId); setAttachingMasterId(masterId); }}
            onDesignate={(projId, masterId) =>
              act("Designate Collectible", "/api/authority/collectibles", { projection_id: projId, master_id: masterId })
            }
            onEditPresentation={masterId => setPresentingMasterId(masterId)}
            onEditProjectionPresentation={(projId, masterId) => { setPresentingProjId(projId); setPresentingProjMasterId(masterId); }}
          />
        );
      })}

      <Separator />

      {/* Canonical Record — secondary technical view */}
      <div className="space-y-4">
        <div>
          <h2 className="text-foreground text-sm font-medium">Canonical Record</h2>
          <p className="text-muted-foreground text-xs">Technical verification of the canonical chain.</p>
        </div>

        {masters.length === 0 && <p className="text-muted-foreground text-xs">No records yet.</p>}

        {masters.map(m => {
          const mStates = states.filter(s => s.master_id === m.master_id);
          const mProjs = projections.filter(p => p.master_id === m.master_id);
          const typeLabel = WORK_TYPE_LABELS[m.canonical_type] ?? m.canonical_type;
          return (
            <Card key={m.master_id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{typeLabel}</Badge>
                  <span className="text-muted-foreground font-mono text-xs cursor-default" title={m.master_id}>{shortId(m.master_id)}…</span>
                </div>
                {mStates.length === 0 && <p className="text-muted-foreground text-xs pl-4">No authorised state.</p>}
                {mStates.map(s => (
                  <div key={s.canonical_state_id} className="pl-4 border-l border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{s.version}</Badge>
                      <Badge variant="outline">{s.authorisation_state}</Badge>
                      <span className="text-muted-foreground font-mono text-xs cursor-default" title={s.canonical_state_id}>{shortId(s.canonical_state_id)}…</span>
                    </div>
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                      const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                      const projLabel = EXPERIENCE_TYPE_LABELS[p.projection_type] ?? p.projection_type;
                      return (
                        <div key={p.projection_id} className="pl-4 border-l border-border space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge>{projLabel}</Badge>
                            {p.collectible_designated && <Badge variant="secondary">collectible</Badge>}
                            <span className="text-muted-foreground font-mono text-xs cursor-default" title={p.projection_id}>{shortId(p.projection_id)}…</span>
                          </div>
                          {pBindings.length === 0 && <p className="text-muted-foreground text-xs pl-4">No media.</p>}
                          {pBindings.map(b => (
                            <div key={b.binding_id} className="pl-4 flex items-center gap-2">
                              <Badge variant="outline">{b.binding_type}</Badge>
                              <Badge variant="outline">{b.access_level}</Badge>
                              <span className="text-muted-foreground font-mono text-xs cursor-default" title={b.asset_id}>{shortId(b.asset_id)}…</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).length === 0 && (
                      <p className="text-muted-foreground text-xs pl-4">No experience.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string }[];
};

const CANONICAL_TYPES: { value: string; label: string }[] = [
  { value: "song-world", label: "Song World" },
  { value: "creative-moment", label: "Creative Moment" },
  { value: "mural", label: "Mural" },
  { value: "interpretation", label: "Interpretation" },
  { value: "other", label: "Other" },
];

const PROJECTION_TYPES: { value: string; label: string }[] = [
  { value: "experiential", label: "Experiential" },
  { value: "distributional", label: "Distributional" },
  { value: "archival", label: "Archival" },
  { value: "other", label: "Other" },
];

function shortId(id: string) {
  return id.slice(0, 8);
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function AuthorityClient() {
  const [data, setData] = useState<AuthorityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Register New Work
  const [canonicalType, setCanonicalType] = useState<string>("song-world");

  // Advance Work State
  const [stateMasterId, setStateMasterId] = useState("");

  // Create Projection
  const [projStateId, setProjStateId] = useState("");
  const [projMasterId, setProjMasterId] = useState("");
  const [projType, setProjType] = useState<string>("experiential");

  // Attach Media
  const [uploadProjId, setUploadProjId] = useState("");
  const [uploadMasterId, setUploadMasterId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Designate Collectible
  const [colProjId, setColProjId] = useState("");
  const [colMasterId, setColMasterId] = useState("");

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

  const { authority, masters, states, projections, bindings } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-foreground text-lg font-semibold">Authority</h1>
        <p className="text-muted-foreground text-xs">
          {authority.authority_type} · {authority.scope_type}
        </p>
      </div>

      {msg && <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{msg}</p>}

      <Separator />

      {/* 1. Register New Work */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Register New Work</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ctype">Work type</Label>
            <select
              id="ctype"
              value={canonicalType}
              onChange={e => setCanonicalType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {CANONICAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Button size="sm" disabled={busy} onClick={() => act("Register Work", "/api/authority/masters", { canonical_type: canonicalType })}>
            Register Work
          </Button>
        </CardContent>
      </Card>

      {/* 2. Advance Work State */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Advance Work State</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="smid">Work</Label>
            <select
              id="smid"
              value={stateMasterId}
              onChange={e => setStateMasterId(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select work —</option>
              {masters.map(m => (
                <option key={m.master_id} value={m.master_id}>
                  {CANONICAL_TYPES.find(t => t.value === m.canonical_type)?.label ?? m.canonical_type} · {shortId(m.master_id)}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" disabled={busy || !stateMasterId} onClick={() => act("Advance State", "/api/authority/states", { master_id: stateMasterId })}>
            Advance State
          </Button>
        </CardContent>
      </Card>

      {/* 3. Create Projection */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Create Projection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="psid">State</Label>
            <select
              id="psid"
              value={projStateId}
              onChange={e => {
                const s = states.find(s => s.canonical_state_id === e.target.value);
                setProjStateId(s?.canonical_state_id ?? "");
                setProjMasterId(s?.master_id ?? "");
              }}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select state —</option>
              {states.map(s => {
                const m = masters.find(m => m.master_id === s.master_id);
                return (
                  <option key={s.canonical_state_id} value={s.canonical_state_id}>
                    {CANONICAL_TYPES.find(t => t.value === m?.canonical_type)?.label ?? m?.canonical_type ?? "Unknown"} · v{s.version} · {shortId(s.canonical_state_id)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ptype">Projection type</Label>
            <select
              id="ptype"
              value={projType}
              onChange={e => setProjType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {PROJECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Button size="sm" disabled={busy || !projStateId || !projMasterId} onClick={() => act("Create Projection", "/api/authority/projections", { canonical_state_id: projStateId, master_id: projMasterId, projection_type: projType })}>
            Create Projection
          </Button>
        </CardContent>
      </Card>

      {/* 4. Attach Media */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Attach Media</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {/* Step 1 */}
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">1 · Select projection</p>
            <select
              disabled={uploadBusy}
              value={uploadProjId}
              onChange={e => {
                const proj = projections.find(p => p.projection_id === e.target.value);
                setUploadProjId(proj?.projection_id ?? "");
                setUploadMasterId(proj?.master_id ?? "");
                setUploadFile(null);
                setUploadMsg(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select projection —</option>
              {projections.map(p => {
                const m = masters.find(m => m.master_id === p.master_id);
                const hasMedia = bindings.some(b => b.projection_id === p.projection_id);
                return (
                  <option key={p.projection_id} value={p.projection_id}>
                    {PROJECTION_TYPES.find(t => t.value === p.projection_type)?.label ?? p.projection_type} · {CANONICAL_TYPES.find(t => t.value === m?.canonical_type)?.label ?? m?.canonical_type ?? "Unknown"}{hasMedia ? " · media attached" : ""}
                  </option>
                );
              })}
            </select>
            {uploadProjId && (
              <p className="text-muted-foreground font-mono text-xs" title={uploadProjId}>{shortId(uploadProjId)}…</p>
            )}
          </div>

          {/* Step 2 */}
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">2 · Choose video</p>
            <input
              ref={fileInputRef}
              id="mp4file"
              type="file"
              accept="video/mp4,video/*"
              disabled={uploadBusy}
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
                setUploadMsg(null);
              }}
              className="sr-only"
            />
            <button
              type="button"
              disabled={uploadBusy}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors
                ${uploadFile
                  ? "border-border bg-muted/30"
                  : "border-border hover:border-foreground/30 hover:bg-muted/20 cursor-pointer"
                }
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

          {/* Step 3 — progress / status */}
          {uploadBusy && (
            <div className="space-y-2">
              {uploadProgress !== null && uploadProgress < 100 ? (
                <>
                  <p className="text-foreground text-sm">Uploading video…</p>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
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
            disabled={uploadBusy || !uploadProjId || !uploadMasterId || !uploadFile}
            onClick={async () => {
              if (!uploadFile) return;
              setUploadBusy(true); setUploadMsg(null); setUploadProgress(null); setUploadPhase(null);
              try {
                const session = await fetch("/api/authority/media/upload-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: uploadFile.name, projection_id: uploadProjId, master_id: uploadMasterId }),
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
                  body: JSON.stringify({ projection_id: uploadProjId, master_id: uploadMasterId, livepeer_asset_id: asset_id }),
                }).then(r => r.json());

                if (attach.error) { setUploadMsg(`Error: ${attach.error}`); return; }
                setUploadMsg("Video attached. World and Moment are now playable.");
                setUploadFile(null); setUploadProgress(null); setUploadPhase(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                await load();
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

      {/* 5. Designate Collectible */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Designate Collectible</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cpid">Projection</Label>
            <select
              id="cpid"
              value={colProjId}
              onChange={e => {
                const proj = projections.find(p => p.projection_id === e.target.value);
                setColProjId(proj?.projection_id ?? "");
                setColMasterId(proj?.master_id ?? "");
              }}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select projection —</option>
              {projections.map(p => {
                const m = masters.find(m => m.master_id === p.master_id);
                return (
                  <option key={p.projection_id} value={p.projection_id}>
                    {PROJECTION_TYPES.find(t => t.value === p.projection_type)?.label ?? p.projection_type} · {CANONICAL_TYPES.find(t => t.value === m?.canonical_type)?.label ?? m?.canonical_type ?? "Unknown"}{p.collectible_designated ? " · collectible" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <Button size="sm" disabled={busy || !colProjId || !colMasterId} onClick={() => act("Designate Collectible", "/api/authority/collectibles", { projection_id: colProjId, master_id: colMasterId })}>
            Designate as Collectible
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Canonical Chain */}
      <div className="space-y-4">
        <h2 className="text-foreground text-sm font-medium">Canonical Chain</h2>

        {masters.length === 0 && <p className="text-muted-foreground text-xs">No works registered yet.</p>}

        {masters.map(m => {
          const mStates = states.filter(s => s.master_id === m.master_id);
          const mProjs = projections.filter(p => p.master_id === m.master_id);
          const typeLabel = CANONICAL_TYPES.find(t => t.value === m.canonical_type)?.label ?? m.canonical_type;
          return (
            <Card key={m.master_id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{typeLabel}</Badge>
                  <span className="text-muted-foreground font-mono text-xs cursor-default" title={m.master_id}>{shortId(m.master_id)}…</span>
                </div>
                {mStates.map(s => (
                  <div key={s.canonical_state_id} className="pl-4 border-l border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{s.version}</Badge>
                      <Badge variant="outline">{s.authorisation_state}</Badge>
                      <span className="text-muted-foreground font-mono text-xs cursor-default" title={s.canonical_state_id}>{shortId(s.canonical_state_id)}…</span>
                    </div>
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                      const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                      const projLabel = PROJECTION_TYPES.find(t => t.value === p.projection_type)?.label ?? p.projection_type;
                      return (
                        <div key={p.projection_id} className="pl-4 border-l border-border space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge>{projLabel}</Badge>
                            {p.collectible_designated && <Badge variant="secondary">collectible</Badge>}
                            <span className="text-muted-foreground font-mono text-xs cursor-default" title={p.projection_id}>{shortId(p.projection_id)}…</span>
                          </div>
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

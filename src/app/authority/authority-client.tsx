"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AuthorityData = {
  authority: { authority_id: string; authority_type: string; scope_type: string; capabilities: string[] };
  masters: { master_id: string; canonical_type: string; current_state_id: string | null; created_at: string }[];
  states: { canonical_state_id: string; master_id: string; version: number; authorisation_state: string; integrity_hash: string; created_at: string }[];
  projections: { projection_id: string; canonical_state_id: string; master_id: string; projection_type: string; collectible_designated: boolean; integrity_hash: string; created_at: string }[];
  bindings: { binding_id: string; projection_id: string; binding_type: string; access_level: string; asset_id: string }[];
};

const CANONICAL_TYPES = ["song-world", "creative-moment", "mural", "interpretation", "other"] as const;
const PROJECTION_TYPES = ["experiential", "distributional", "archival", "other"] as const;

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

  // Register Master form
  const [canonicalType, setCanonicalType] = useState<string>("song-world");

  // Create State form
  const [stateMasterId, setStateMasterId] = useState("");

  // Create Projection form
  const [projStateId, setProjStateId] = useState("");
  const [projMasterId, setProjMasterId] = useState("");
  const [projType, setProjType] = useState<string>("experiential");

  // Attach Media — upload state
  const [uploadProjId, setUploadProjId] = useState("");
  const [uploadMasterId, setUploadMasterId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // Designate Collectible form
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

      {/* 1. Register Master */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Register Master</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ctype">Canonical type</Label>
            <select
              id="ctype"
              value={canonicalType}
              onChange={e => setCanonicalType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {CANONICAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button size="sm" disabled={busy} onClick={() => act("Register Master", "/api/authority/masters", { canonical_type: canonicalType })}>
            Register
          </Button>
        </CardContent>
      </Card>

      {/* 2. Create / Advance Canonical State */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Create / Advance Canonical State</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="smid">Master ID</Label>
            <Input id="smid" value={stateMasterId} onChange={e => setStateMasterId(e.target.value)} placeholder="master_id" />
          </div>
          <Button size="sm" disabled={busy || !stateMasterId} onClick={() => act("Create State", "/api/authority/states", { master_id: stateMasterId })}>
            Create State
          </Button>
        </CardContent>
      </Card>

      {/* 3. Create / Authorise Projection */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Create / Authorise Projection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="psid">Canonical State ID</Label>
            <Input id="psid" value={projStateId} onChange={e => setProjStateId(e.target.value)} placeholder="canonical_state_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pmid">Master ID</Label>
            <Input id="pmid" value={projMasterId} onChange={e => setProjMasterId(e.target.value)} placeholder="master_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ptype">Projection type</Label>
            <select
              id="ptype"
              value={projType}
              onChange={e => setProjType(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              {PROJECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button size="sm" disabled={busy || !projStateId || !projMasterId} onClick={() => act("Create Projection", "/api/authority/projections", { canonical_state_id: projStateId, master_id: projMasterId, projection_type: projType })}>
            Authorise Projection
          </Button>
        </CardContent>
      </Card>

      {/* 4. Attach Media — MP4 upload */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Attach Media</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="uprojsel">Projection</Label>
            <select
              id="uprojsel"
              disabled={uploadBusy}
              value={uploadProjId}
              onChange={e => {
                const proj = projections.find(p => p.projection_id === e.target.value);
                setUploadProjId(proj?.projection_id ?? "");
                setUploadMasterId(proj?.master_id ?? "");
              }}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">— select projection —</option>
              {projections.map(p => {
                const m = masters.find(m => m.master_id === p.master_id);
                const hasMedia = bindings.some(b => b.projection_id === p.projection_id);
                return (
                  <option key={p.projection_id} value={p.projection_id}>
                    {p.projection_type} · {m?.canonical_type ?? "unknown"}{hasMedia ? " · media attached" : " · awaiting media"}
                  </option>
                );
              })}
            </select>
            {uploadProjId && <p className="text-muted-foreground font-mono text-xs">{uploadProjId}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="mp4file">MP4 file</Label>
            <input
              id="mp4file"
              type="file"
              accept="video/mp4,video/*"
              disabled={uploadBusy}
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setUploadFile(f);
              }}
              className="text-foreground text-sm w-full"
            />
            {uploadFile && <p className="text-muted-foreground text-xs">{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>
          {uploadProgress !== null && (
            <p className="text-muted-foreground text-xs">Uploading… {uploadProgress}%</p>
          )}
          {uploadPhase && uploadPhase !== "ready" && (
            <p className="text-muted-foreground text-xs">Processing: {uploadPhase}</p>
          )}
          {uploadMsg && (
            <p className={`text-sm ${uploadMsg.startsWith("Error") ? "text-destructive" : "text-foreground"}`}>{uploadMsg}</p>
          )}
          <Button
            size="sm"
            disabled={uploadBusy || !uploadProjId || !uploadMasterId || !uploadFile}
            onClick={async () => {
              if (!uploadFile) return;
              setUploadBusy(true); setUploadMsg(null); setUploadProgress(null); setUploadPhase(null);
              try {
                // 1. Create upload session server-side
                const session = await fetch("/api/authority/media/upload-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: uploadFile.name, projection_id: uploadProjId, master_id: uploadMasterId }),
                }).then(r => r.json());

                if (session.error) { setUploadMsg(`Error: ${session.error}`); return; }

                const { upload_url, asset_id } = session;

                // 2. Upload directly to pre-authenticated Livepeer endpoint
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

                // 3. Poll until ready
                let phase = "uploading";
                while (phase !== "ready") {
                  await new Promise(r => setTimeout(r, 3000));
                  const status = await fetch(`/api/authority/media/upload-session/${asset_id}`).then(r => r.json());
                  phase = status.phase ?? "unknown";
                  setUploadPhase(phase);
                  if (phase === "failed") { setUploadMsg("Error: Livepeer processing failed"); return; }
                }

                // 4. Attach via existing canonical operation
                const attach = await fetch("/api/authority/media", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ projection_id: uploadProjId, master_id: uploadMasterId, livepeer_asset_id: asset_id }),
                }).then(r => r.json());

                if (attach.error) { setUploadMsg(`Error: ${attach.error}`); return; }
                setUploadMsg("Media attached. World and Moment are now playable.");
                setUploadFile(null); setUploadProgress(null); setUploadPhase(null);
                await load();
              } catch (err) {
                setUploadMsg(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
              } finally {
                setUploadBusy(false);
              }
            }}
          >
            {uploadBusy ? (uploadProgress !== null && uploadProgress < 100 ? `Uploading ${uploadProgress}%` : uploadPhase ? `Processing…` : "Starting…") : "Upload & Attach"}
          </Button>
        </CardContent>
      </Card>

      {/* 5. Designate Collectible */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Designate Collectible</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cpid">Projection ID</Label>
            <Input id="cpid" value={colProjId} onChange={e => setColProjId(e.target.value)} placeholder="projection_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cmid">Master ID</Label>
            <Input id="cmid" value={colMasterId} onChange={e => setColMasterId(e.target.value)} placeholder="master_id" />
          </div>
          <Button size="sm" disabled={busy || !colProjId || !colMasterId} onClick={() => act("Designate Collectible", "/api/authority/collectibles", { projection_id: colProjId, master_id: colMasterId })}>
            Designate
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Canonical chain view */}
      <div className="space-y-4">
        <h2 className="text-foreground text-sm font-medium">Canonical Chain</h2>

        {masters.length === 0 && <p className="text-muted-foreground text-xs">No masters yet.</p>}

        {masters.map(m => {
          const mStates = states.filter(s => s.master_id === m.master_id);
          const mProjs = projections.filter(p => p.master_id === m.master_id);
          return (
            <Card key={m.master_id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.canonical_type}</Badge>
                  <span className="text-muted-foreground font-mono text-xs">{m.master_id}</span>
                </div>
                {mStates.map(s => (
                  <div key={s.canonical_state_id} className="pl-4 border-l border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{s.version}</Badge>
                      <Badge variant="outline">{s.authorisation_state}</Badge>
                      <span className="text-muted-foreground font-mono text-xs truncate max-w-[200px]">{s.canonical_state_id}</span>
                    </div>
                    {mProjs.filter(p => p.canonical_state_id === s.canonical_state_id).map(p => {
                      const pBindings = bindings.filter(b => b.projection_id === p.projection_id);
                      return (
                        <div key={p.projection_id} className="pl-4 border-l border-border space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge>{p.projection_type}</Badge>
                            {p.collectible_designated && <Badge variant="secondary">collectible</Badge>}
                            <span className="text-muted-foreground font-mono text-xs truncate max-w-[200px]">{p.projection_id}</span>
                          </div>
                          {pBindings.map(b => (
                            <div key={b.binding_id} className="pl-4 flex items-center gap-2">
                              <Badge variant="outline">{b.binding_type}</Badge>
                              <Badge variant="outline">{b.access_level}</Badge>
                              <span className="text-muted-foreground font-mono text-xs truncate max-w-[160px]">{b.asset_id}</span>
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

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

  // Attach Media form
  const [mediaProjId, setMediaProjId] = useState("");
  const [mediaMasterId, setMediaMasterId] = useState("");
  const [livepeerAssetId, setLivepeerAssetId] = useState("");

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

      {/* 4. Attach Media Binding */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Attach Media Binding</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mpid">Projection ID</Label>
            <Input id="mpid" value={mediaProjId} onChange={e => setMediaProjId(e.target.value)} placeholder="projection_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mmid">Master ID</Label>
            <Input id="mmid" value={mediaMasterId} onChange={e => setMediaMasterId(e.target.value)} placeholder="master_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="laid">Livepeer Asset ID</Label>
            <Input id="laid" value={livepeerAssetId} onChange={e => setLivepeerAssetId(e.target.value)} placeholder="Livepeer asset ID" />
          </div>
          <Button size="sm" disabled={busy || !mediaProjId || !mediaMasterId || !livepeerAssetId} onClick={() => act("Attach Media", "/api/authority/media", { projection_id: mediaProjId, master_id: mediaMasterId, livepeer_asset_id: livepeerAssetId })}>
            Attach
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

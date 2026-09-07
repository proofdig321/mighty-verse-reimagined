"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ParticipantRow = {
  participant_id: string;
  label: string | null;
  status: string | null;
  role: string | null;
};

const ROLE_OPTIONS = [
  { value: "", label: "No role" },
  { value: "artist", label: "Artist" },
  { value: "director", label: "Director" },
  { value: "producer", label: "Producer" },
  { value: "featured-artist", label: "Featured Artist" },
  { value: "collaborator", label: "Collaborator" },
  { value: "operator", label: "Operator" },
  { value: "other", label: "Other" },
];

export default function ParticipantsClient({ participants: initial }: { participants: ParticipantRow[] }) {
  const [participants, setParticipants] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [identityRef, setIdentityRef] = useState("");
  const [roleType, setRoleType] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function register() {
    if (!label.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/authority/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), identity_ref: identityRef.trim() || null, role_type: roleType || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(`Error: ${data.error}`); return; }
    setParticipants((prev) => [
      ...prev,
      { participant_id: data.participant_id, label: label.trim(), status: "active", role: roleType || null },
    ]);
    setLabel(""); setIdentityRef(""); setRoleType("");
    setShowForm(false);
    setMsg(`Participant "${label.trim()}" registered.`);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Participants</h1>
        <p className="text-sm text-muted-foreground">
          People, roles, and authority relationships in the Mighty Verse operational scope.
        </p>
      </div>

      {msg && (
        <p className={`text-sm ${msg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>{msg}</p>
      )}

      {!showForm ? (
        <Button size="sm" onClick={() => { setShowForm(true); setMsg(null); }}>
          Register participant
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Register participant</p>
              <button type="button" onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-widest">Display name (required)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Golden Shovel"
                disabled={busy}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-widest">Identity reference (optional)</label>
              <input
                type="text"
                value={identityRef}
                onChange={(e) => setIdentityRef(e.target.value)}
                placeholder="e.g. @goldenshovel or known identifier"
                disabled={busy}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-widest">Role (optional)</label>
              <select
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
                disabled={busy}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Registering a participant does not automatically assign rights or ISRC eligibility.
              Those are separate explicit operations.
            </p>
            <Button size="sm" disabled={busy || !label.trim()} onClick={register}>
              {busy ? "Registering…" : "Register"}
            </Button>
          </CardContent>
        </Card>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No participants registered yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Participant</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {participants.map((p) => (
                <tr key={p.participant_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.label ?? <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {p.role ?? <span className="italic text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {p.status ?? <span className="italic text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground/50 hidden lg:table-cell">
                    {p.participant_id.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

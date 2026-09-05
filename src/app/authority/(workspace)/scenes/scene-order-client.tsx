"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "../_shared/authority-utils";

type SceneItem = {
  master_id: string;
  title: string | null;
  sort_order: number | null;
};

export default function SceneOrderClient({ scenes: initial }: { scenes: SceneItem[] }) {
  const [scenes, setScenes] = useState(initial);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setScenes((current) => {
      const from = current.findIndex((s) => s.master_id === draggedId);
      const to = current.findIndex((s) => s.master_id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId(null);
  }

  async function saveOrder() {
    setBusy(true);
    setMsg(null);
    const orders = scenes.map((s, i) => ({ master_id: s.master_id, sort_order: i + 1 }));
    const res = await api("/api/authority/masters/sort-order", { orders }, "PATCH");
    setBusy(false);
    if (res.error) { setMsg(`Error: ${res.error}`); return; }
    setScenes((current) => current.map((s, i) => ({ ...s, sort_order: i + 1 })));
    setMsg("Scene order saved.");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Canonical Order</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={saveOrder}>
          {busy ? "Saving…" : "Save order"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Drag to reorder. This sets the canonical Scene sequence used across the public experience.</p>
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {scenes.map((s, i) => (
          <div
            key={s.master_id}
            draggable
            onDragStart={() => setDraggedId(s.master_id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); moveItem(s.master_id); }}
            onDragEnd={() => setDraggedId(null)}
            className={`flex items-center gap-3 px-4 py-3 cursor-grab select-none transition-colors ${draggedId === s.master_id ? "opacity-40" : "hover:bg-muted/20"}`}
          >
            <span className="text-xs font-mono w-5 shrink-0 text-muted-foreground/50">⠿</span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
              style={{ background: "color-mix(in oklch, var(--accent-mv) 20%, var(--card))", color: "var(--accent-mv)" }}
            >
              {i + 1}
            </span>
            <span className="text-sm text-foreground flex-1 truncate">
              {s.title ?? <span className="italic text-muted-foreground">Untitled scene</span>}
            </span>
          </div>
        ))}
      </div>
      {msg && <p className={`text-xs ${msg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>{msg}</p>}
    </div>
  );
}

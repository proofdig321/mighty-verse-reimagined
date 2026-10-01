"use client";

import { useState } from "react";
import { PREFIX_PATTERN } from "@/lib/media/isrc";

type FormState = "idle" | "submitting" | "done" | "error";

export function IsrcRegistrantForm() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    registrant_name: "",
    prefix_code: "",
    country_code: "",
    registrant_code: "",
    notes: "",
  });

  function set(k: keyof typeof fields, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prefix = fields.prefix_code.toUpperCase().trim();
    if (!PREFIX_PATTERN.test(prefix)) {
      setError("Prefix must be exactly 5 uppercase alphanumeric characters (e.g. GBSHE).");
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/authority/isrc/registrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrant_name: fields.registrant_name.trim(),
          prefix_code: prefix,
          country_code: fields.country_code.trim() || null,
          registrant_code: fields.registrant_code.trim() || null,
          notes: fields.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to configure registrant.");
        setState("error");
        return;
      }
      setState("done");
      // Reload to reflect new registrant
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setState("error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Configure registrant prefix
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Configure ISRC Registrant</p>
      <p className="text-xs text-muted-foreground/70">
        Only configure this with an authorized prefix obtained from the national ISRC Agency.
        Do not use a placeholder or invented prefix.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-1" htmlFor="reg-name">Registrant name <span className="text-destructive">*</span></label>
          <input
            id="reg-name"
            required
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
            value={fields.registrant_name}
            onChange={(e) => set("registrant_name", e.target.value)}
            placeholder="Golden Shovel"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1" htmlFor="reg-prefix">
            Prefix code <span className="text-destructive">*</span>
            <span className="ml-1 text-muted-foreground/50">(5 chars, e.g. GBSHE)</span>
          </label>
          <input
            id="reg-prefix"
            required
            maxLength={5}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs font-mono text-foreground uppercase"
            value={fields.prefix_code}
            onChange={(e) => set("prefix_code", e.target.value.toUpperCase())}
            placeholder="GBSHE"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1" htmlFor="reg-country">Country code</label>
          <input
            id="reg-country"
            maxLength={2}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs font-mono text-foreground uppercase"
            value={fields.country_code}
            onChange={(e) => set("country_code", e.target.value.toUpperCase())}
            placeholder="ZA"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1" htmlFor="reg-code">Registrant code</label>
          <input
            id="reg-code"
            maxLength={3}
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs font-mono text-foreground uppercase"
            value={fields.registrant_code}
            onChange={(e) => set("registrant_code", e.target.value.toUpperCase())}
            placeholder="SHE"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground mb-1" htmlFor="reg-notes">Notes</label>
          <input
            id="reg-notes"
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. Registered via RISA 2026"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => { setOpen(false); setState("idle"); setError(null); }}
          className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="px-3 py-1.5 text-xs rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
        >
          {state === "submitting" ? "Saving…" : "Save Registrant"}
        </button>
      </div>
    </form>
  );
}

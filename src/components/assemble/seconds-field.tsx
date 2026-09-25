"use client";

import { useState } from "react";
import { formatMs, parseOperatorSeconds } from "@/lib/media/timing";

/**
 * Time input that shows m:ss and accepts m:ss, m:ss.mmm, or plain seconds.
 * Storage unit is always milliseconds.
 */
export function SecondsField({
  label,
  valueMs,
  onChange,
  disabled = false,
}: {
  label: string;
  valueMs: number;
  onChange: (ms: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = parseOperatorSeconds(raw);
    if (next != null) onChange(next);
    setEditing(false);
  }

  return (
    <label className="text-xs text-muted-foreground block">
      {label}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={editing ? draft : formatMs(valueMs)}
        onFocus={() => { setDraft(formatMs(valueMs)); setEditing(true); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") setEditing(false); }}
        placeholder="m:ss"
        className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm font-mono"
      />
    </label>
  );
}

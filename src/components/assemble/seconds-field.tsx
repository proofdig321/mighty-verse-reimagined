"use client";

import { parseOperatorSeconds, secondsFromMs } from "@/lib/media/timing";

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
  return (
    <label className="text-xs text-muted-foreground">
      {label} (s)
      <input
        type="number"
        min={0}
        step={0.1}
        disabled={disabled}
        value={secondsFromMs(valueMs)}
        onChange={(event) => {
          const next = parseOperatorSeconds(event.target.value);
          if (next != null) onChange(next);
        }}
        className="border-input bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-sm"
      />
    </label>
  );
}

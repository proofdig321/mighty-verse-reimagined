"use client";

import { useEffect, useState } from "react";
import { isThemePreset, THEME_PRESETS, THEME_STORAGE_KEY, type ThemePresetId } from "@/lib/theme/presets";

export function ThemePresetControl() {
  const [preset, setPreset] = useState<ThemePresetId>("default");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreset(stored)) {
      setPreset(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function apply(next: ThemePresetId) {
    setPreset(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <label className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      Theme
      <select
        aria-label="Theme preset"
        value={preset}
        onChange={(event) => apply(event.target.value as ThemePresetId)}
        className="h-8 max-w-[10rem] rounded-md border border-border bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"
      >
        {THEME_PRESETS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

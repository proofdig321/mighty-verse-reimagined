"use client";

/**
 * StudioAdvisor — contextual creative advice inside the Storyboard.
 *
 * Advisory only. Does not mutate canonical state, generation settings,
 * or the storyboard work. Creator remains in control.
 *
 * Uses the existing advise action on /api/authority/storyboard which
 * consumes CreativeContext + generation settings via Gemini.
 */

import { useState } from "react";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type AdvisorState = "idle" | "loading" | "ready" | "unavailable";

export function StudioAdvisor({
  workId,
  panelId,
  directive,
  generationSettings,
  configured,
}: {
  workId: string | null;
  panelId: string | null;
  directive: string | null;
  generationSettings: Record<string, unknown>;
  configured: boolean;
}) {
  const [state, setState] = useState<AdvisorState>("idle");
  const [advice, setAdvice] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  if (!configured || dismissed) return null;

  async function requestAdvice() {
    if (!workId) return;
    setState("loading");
    setDismissed(false);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "advise",
        work_id: workId,
        panel_id: panelId,
        directive,
        generation_settings: generationSettings,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.advice) {
      setState("unavailable");
      return;
    }
    const lines = String(payload.advice)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    setAdvice(lines);
    setState("ready");
  }

  return (
    <div className="studio-advisor">
      {state === "idle" && (
        <button
          type="button"
          onClick={() => void requestAdvice()}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <Sparkles size={10} />
          Creative advice
        </button>
      )}

      {state === "loading" && (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 animate-pulse">
          <Sparkles size={10} />
          Reviewing context…
        </p>
      )}

      {state === "unavailable" && (
        <p className="text-[10px] text-muted-foreground/40">Advisor unavailable — Gemini not configured.</p>
      )}

      {state === "ready" && advice.length > 0 && (
        <div className="studio-advisor-card">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 flex items-center gap-1">
              <Sparkles size={8} /> Advisory
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Refresh advice"
                onClick={() => void requestAdvice()}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              >
                <RefreshCw size={9} />
              </button>
              <button
                type="button"
                title="Dismiss"
                onClick={() => setDismissed(true)}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              >
                <X size={9} />
              </button>
            </div>
          </div>
          <ul className={cn("mt-1.5 space-y-1")}>
            {advice.map((line, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-snug">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] text-muted-foreground/30">Advisory only. Creator decides.</p>
        </div>
      )}
    </div>
  );
}

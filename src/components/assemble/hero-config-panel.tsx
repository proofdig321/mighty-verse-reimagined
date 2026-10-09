"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HeroConfig } from "@/lib/hero-config";
import { heroConfig as defaults } from "@/lib/hero-config";
import { StudioField, studioInputClass, studioTextareaClass, studioSelectClass } from "@/components/assemble/studio-field";
import { StudioFeedback } from "@/components/assemble/studio-feedback";

export function HeroConfigPanel({
  universes,
}: {
  universes: { master_id: string; title: string | null }[];
}) {
  const [draft, setDraft] = useState<HeroConfig>({ ...defaults });
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/authority/site-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setDraft(d.config as HeroConfig);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function set<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/authority/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`Error: ${data.error ?? "Save failed"}`); return; }
      setMsg("Saved. Home page will reflect this on next request.");
    } finally {
      setBusy(false);
    }
  }

  const previewUniverse = draft.featuredUniverseId
    ? universes.find((u) => u.master_id === draft.featuredUniverseId)
    : universes[0] ?? null;

  if (!loaded) {
    return <div className="h-10 animate-pulse rounded bg-muted/40" />;
  }

  return (
    <div className="studio-composer">
      {/* Live preview */}
      <div className="rounded border border-border bg-background/40 px-4 py-3 space-y-1">
        <p className="suite-kicker">Preview</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-accent-mv">
          {draft.eyebrow || "—"}
        </p>
        <p className="text-lg font-semibold leading-tight text-foreground">
          {draft.headline || "—"}
        </p>
        {draft.description ? (
          <p className="text-xs text-muted-foreground">{draft.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex h-7 items-center rounded px-3 text-xs font-semibold text-white" style={{ background: "var(--accent-mv)" }}>
            Explore Universes
          </span>
          {draft.showTrailerCta && (
            <span className="inline-flex h-7 items-center rounded border border-border px-3 text-xs text-muted-foreground">
              Watch Trailer
            </span>
          )}
        </div>
        {previewUniverse ? (
          <p className="text-[10px] text-muted-foreground pt-1">
            Background: {previewUniverse.title ?? previewUniverse.master_id}
          </p>
        ) : null}
      </div>

      {/* Fields */}
      <div className="grid gap-3 border-t border-border pt-3">
        <StudioField label="Eyebrow" hint="Short uppercase line above the headline">
          <input
            type="text"
            value={draft.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            disabled={busy}
            className={studioInputClass}
          />
        </StudioField>

        <StudioField label="Headline" hint="Main hero headline — plain text">
          <textarea
            value={draft.headline}
            onChange={(e) => set("headline", e.target.value)}
            rows={2}
            disabled={busy}
            className={studioTextareaClass}
          />
        </StudioField>

        <StudioField label="Description" hint="Supporting copy below the headline">
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            disabled={busy}
            className={studioTextareaClass}
          />
        </StudioField>

        <StudioField label="Featured Universe" hint="Pin a specific Universe as the hero background. Auto selects the first with a video.">
          <select
            value={draft.featuredUniverseId ?? ""}
            onChange={(e) => set("featuredUniverseId", e.target.value || null)}
            disabled={busy}
            className={studioSelectClass}
          >
            <option value="">Auto (first with video)</option>
            {universes.map((u) => (
              <option key={u.master_id} value={u.master_id}>
                {u.title ?? u.master_id}
              </option>
            ))}
          </select>
        </StudioField>

        <StudioField label="Show Trailer CTA" hint='Show "Watch Trailer" button when a background video is available'>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={draft.showTrailerCta}
              disabled={busy}
              onClick={() => set("showTrailerCta", !draft.showTrailerCta)}
              className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border bg-background/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              style={draft.showTrailerCta ? { background: "var(--accent-mv)" } : undefined}
            >
              <span
                className="pointer-events-none inline-block h-4 w-4 rounded-full bg-foreground shadow transition-transform mt-px"
                style={{ transform: draft.showTrailerCta ? "translateX(1rem)" : "translateX(1px)" }}
              />
            </button>
            <span className="text-xs text-muted-foreground">
              {draft.showTrailerCta ? "Enabled" : "Disabled"}
            </span>
          </div>
        </StudioField>
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-3">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <StudioFeedback message={msg} />
      </div>
    </div>
  );
}

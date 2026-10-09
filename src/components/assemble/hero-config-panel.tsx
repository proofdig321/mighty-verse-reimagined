"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HeroConfig } from "@/lib/hero-config";
import { StudioField, studioInputClass, studioTextareaClass } from "@/components/assemble/studio-field";
import { StudioFeedback } from "@/components/assemble/studio-feedback";

type VideoAsset = {
  asset_id: string;
  title: string | null;
  provider: string | null;
  storage_ref: string;
};

export function HeroConfigPanel({
  videoAssets,
  initialConfig,
}: {
  videoAssets: VideoAsset[];
  initialConfig: HeroConfig;
}) {
  const [draft, setDraft] = useState<HeroConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const selectedAsset = draft.heroMediaId
    ? videoAssets.find((a) => a.asset_id === draft.heroMediaId)
    : null;

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
        {selectedAsset ? (
          <p className="text-[10px] text-muted-foreground pt-1">
            Background: {selectedAsset.title ?? selectedAsset.asset_id}
            {selectedAsset.provider ? ` · ${selectedAsset.provider}` : ""}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 pt-1">Background: auto (first playable video)</p>
        )}
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

        <StudioField label="Hero Background Video" hint="Pin a specific video asset. Leave blank to auto-select the first playable video.">
          <select
            value={draft.heroMediaId ?? ""}
            onChange={(e) => set("heroMediaId", e.target.value || null)}
            disabled={busy}
            className="w-full rounded border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="">Auto (first playable video)</option>
            {videoAssets.map((a) => (
              <option key={a.asset_id} value={a.asset_id}>
                {a.title ?? a.asset_id}
                {a.provider ? ` · ${a.provider}` : ""}
              </option>
            ))}
          </select>
        </StudioField>

        <StudioField label="Text Colour" hint="Light = white text for dark videos. Dark = dark text for light/bright videos.">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((scheme) => (
              <button
                key={scheme}
                type="button"
                disabled={busy}
                onClick={() => set("textScheme", scheme)}
                className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  draft.textScheme === scheme
                    ? "border-foreground/60 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-border/60"
                  style={{ background: scheme === "light" ? "#ffffff" : "#0a0a0a" }}
                />
                {scheme === "light" ? "Light (white)" : "Dark (black)"}
              </button>
            ))}
          </div>
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

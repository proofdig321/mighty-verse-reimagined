"use client";

import { useState } from "react";
import { heroConfig, type HeroConfig } from "@/lib/hero-config";

type Field = {
  key: keyof HeroConfig;
  label: string;
  hint: string;
  type: "text" | "textarea" | "toggle" | "universe-id";
};

const FIELDS: Field[] = [
  {
    key: "eyebrow",
    label: "Eyebrow",
    hint: "Short uppercase line above the headline.",
    type: "text",
  },
  {
    key: "headline",
    label: "Headline",
    hint: "Main hero headline. Plain text — no cycling titles.",
    type: "textarea",
  },
  {
    key: "description",
    label: "Description",
    hint: "Supporting copy below the headline.",
    type: "textarea",
  },
  {
    key: "featuredUniverseId",
    label: "Featured Universe ID",
    hint: "Pin a specific Universe as the hero background video. Leave blank to auto-select the first Universe with a video.",
    type: "universe-id",
  },
  {
    key: "showTrailerCta",
    label: "Show Trailer CTA",
    hint: 'Show “Watch Trailer” button when a background video is available.',
    type: "toggle",
  },
];

export function HeroConfigPanel({
  universes,
}: {
  universes: { master_id: string; title: string | null }[];
}) {
  const [draft, setDraft] = useState<HeroConfig>({ ...heroConfig });

  function set<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Preview: find the universe that would be selected
  const previewUniverse = draft.featuredUniverseId
    ? universes.find((u) => u.master_id === draft.featuredUniverseId)
    : universes[0] ?? null;

  return (
    <div className="studio-composer">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="suite-kicker">Home Hero</p>
          <p className="text-sm font-medium text-foreground mt-0.5">Hero configuration</p>
        </div>
        {false && (
          <p className="text-xs text-muted-foreground" role="status">
            Config updated — redeploy to publish.
          </p>
        )}
      </div>

      {/* Live preview strip */}
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
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1">
            <label className="studio-authoring-label">{field.label}</label>
            {field.type === "toggle" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.showTrailerCta}
                  onClick={() => set("showTrailerCta", !draft.showTrailerCta)}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border bg-background/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  style={draft.showTrailerCta ? { background: "var(--accent-mv)" } : undefined}
                >
                  <span
                    className="pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-foreground shadow transition-transform"
                    style={{ transform: draft.showTrailerCta ? "translateX(1rem)" : "translateX(1px)", marginTop: "1px" }}
                  />
                </button>
                <span className="text-xs text-muted-foreground">{field.hint}</span>
              </div>
            ) : field.type === "universe-id" ? (
              <div className="grid gap-1">
                <select
                  value={draft.featuredUniverseId ?? ""}
                  onChange={(e) => set("featuredUniverseId", e.target.value || null)}
                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs text-foreground"
                >
                  <option value="">Auto (first with video)</option>
                  {universes.map((u) => (
                    <option key={u.master_id} value={u.master_id}>
                      {u.title ?? u.master_id}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">{field.hint}</p>
              </div>
            ) : field.type === "textarea" ? (
              <div className="grid gap-1">
                <textarea
                  value={String(draft[field.key] ?? "")}
                  onChange={(e) => set(field.key as "headline" | "description", e.target.value)}
                  rows={2}
                  className="rounded border border-input bg-background/60 px-2 py-1.5 text-xs text-foreground resize-none"
                />
                <p className="text-[10px] text-muted-foreground">{field.hint}</p>
              </div>
            ) : (
              <div className="grid gap-1">
                <input
                  type="text"
                  value={String(draft[field.key] ?? "")}
                  onChange={(e) => set(field.key as "eyebrow", e.target.value)}
                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs text-foreground"
                />
                <p className="text-[10px] text-muted-foreground">{field.hint}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-[10px] text-muted-foreground">
          Changes here update <code className="font-mono">src/lib/hero-config.ts</code> and take effect on next deploy. A future release will persist this to the database without a redeploy.
        </p>
      </div>
    </div>
  );
}

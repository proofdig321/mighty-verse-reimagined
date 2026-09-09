"use client";

import { useState } from "react";
import Link from "next/link";
import ProjectionMediaPlayer from "@/components/player/projection-media-player";
import { buttonVariants } from "@/components/ui/button";
import { formatDuration, formatTimelineMs } from "@/lib/media/timing";
import type { SuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import { cn } from "@/lib/utils";

export function SourcePreview({
  source,
  inspectHref,
}: {
  source: SuiteSourcePreview;
  inspectHref?: string | null;
}) {
  const [seek, setSeek] = useState<number | null>(null);
  const durationMs = source.duration_ms ?? Math.max(0, ...source.windows.map((window) => window.end_ms));

  return (
    <div className="suite-source" data-suite-source-preview="">
      <ProjectionMediaPlayer
        media={{
          binding_type: "primary",
          access_level: "public",
          delivery_format: "hls",
          playback_id: source.playback_id,
          provider: source.provider,
          media_class: "video",
          endpoint_ref: source.endpoint_ref,
          is_placeholder: false,
          start_ms: null,
          end_ms: null,
        }}
        projectionId={source.mural_projection_id}
        masterId={source.mural_id}
        canonicalStateId={source.mural_canonical_state_id ?? source.mural_id}
        seekToSeconds={seek}
      />
      <div className="suite-source-meta">
        <p className="suite-kicker">Source media</p>
        <p className="text-sm text-foreground">
          {source.title ?? "Bound media"} · {source.provider}
          {durationMs ? ` · ${formatDuration(durationMs / 1000)}` : ""}
        </p>
        <p className="suite-section-note">
          Bound to Mural {source.mural_title ?? "Untitled mural"}. Preview does not change canonical Scene windows.
        </p>
        {inspectHref ? (
          <Link href={inspectHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 inline-flex")}>
            Open Sentinel Inspect
          </Link>
        ) : null}
      </div>
      {source.windows.length > 0 && durationMs > 0 ? (
        <div className="suite-source-windows">
          <p className="suite-relation-kicker">Canonical Scene windows</p>
          <p className="suite-section-note">
            These marks show authorised Scene timing on the source. Selecting a window seeks the preview only.
          </p>
          <div className="suite-window-track" aria-hidden="true">
            {source.windows.map((window) => (
              <span
                key={window.scene_master_id}
                className="suite-window-mark"
                style={{
                  left: `${(window.start_ms / durationMs) * 100}%`,
                  width: `${((window.end_ms - window.start_ms) / durationMs) * 100}%`,
                }}
              />
            ))}
          </div>
          <ul className="suite-window-list">
            {source.windows.map((window) => (
              <li key={window.scene_master_id}>
                <button
                  type="button"
                  className="suite-window-seek"
                  onClick={() => setSeek(window.start_ms / 1000)}
                >
                  <span>{window.title ?? "Scene"}</span>
                  <span className="font-mono">
                    {formatTimelineMs(window.start_ms)} → {formatTimelineMs(window.end_ms)}
                  </span>
                  <span className="suite-canon-badge">Canonical</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

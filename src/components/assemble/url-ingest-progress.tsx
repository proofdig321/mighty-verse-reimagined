"use client";

import {
  URL_INGEST_STAGES,
  urlIngestStageIndex,
  urlIngestStageLabel,
  type UrlIngestStage,
} from "@/lib/media/processing-state";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s elapsed`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s elapsed`;
}

export function UrlIngestProgress({
  stage,
  elapsedMs,
  sourceUrl,
}: {
  stage: UrlIngestStage;
  elapsedMs?: number | null;
  sourceUrl?: string | null;
}) {
  const step = urlIngestStageIndex(stage);
  const failed = stage === "failed";
  const ready = stage === "ready";
  const fill = ready ? 100 : failed ? 50 : Math.round(((step + 0.45) / URL_INGEST_STAGES.length) * 100);

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-card/60 px-4 py-3"
      data-url-ingest-stage={stage}
      data-url-ingest-progress=""
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`text-sm font-medium ${failed ? "text-destructive" : "text-foreground"}`}>
          {urlIngestStageLabel(stage)}
        </p>
        <p className="text-xs text-muted-foreground">
          {ready ? "Done" : failed ? "Stopped" : `Step ${step + 1} of ${URL_INGEST_STAGES.length}`}
          {elapsedMs != null && !ready ? ` · ${formatElapsed(elapsedMs)}` : ""}
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={URL_INGEST_STAGES.length}
        aria-valuenow={ready ? URL_INGEST_STAGES.length : step + 1}
        aria-label="YouTube ingest progress"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${failed ? "bg-destructive" : ""} ${
            !ready && !failed ? "animate-pulse" : ""
          }`}
          style={{
            width: `${fill}%`,
            background: failed ? undefined : "linear-gradient(90deg, var(--accent-mv), var(--accent-mv-gold))",
          }}
        />
      </div>

      <ol className="grid gap-1 sm:grid-cols-3">
        {URL_INGEST_STAGES.map((item, index) => {
          const done = !failed && index < step;
          const active = !failed && index === step;
          return (
            <li
              key={item.id}
              className={`text-xs ${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}
            >
              {done ? "✓ " : active ? "● " : `${index + 1}. `}
              {item.label}
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground">
        A YouTube watch page is not a media file. Mighty Verse fetches the file, then Mux processes it. This bar is the ingest stage, not a fake 0–100.
        {sourceUrl ? ` Source: ${sourceUrl}` : ""} This does not create a Universe.
      </p>
    </div>
  );
}

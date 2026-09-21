import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { StoryboardProgress } from "@/lib/assemble/storyboard-progress";

/**
 * StoryboardProgressBar — shows discrete step completion.
 *
 * Progress is derived from real persisted state only.
 * No fake percentages. No invented counts.
 * Steps: Script → Panels → References → Stills → Motion → Assembly
 */
export function StoryboardProgressBar({ progress }: { progress: StoryboardProgress }) {
  const pct = progress.total > 0
    ? Math.round((progress.completeCount / progress.total) * 100)
    : 0;

  return (
    <div className="storyboard-progress" aria-label="Storyboard progress">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Progress
        </p>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {progress.completeCount} / {progress.total}
        </span>
      </div>

      <Progress
        value={pct}
        aria-label={`${progress.completeCount} of ${progress.total} steps complete`}
        className="mb-3"
      >
        <ProgressTrack className="h-1.5">
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>

      <div className="storyboard-progress-track">
        {progress.steps.map((step) => (
          <div key={step.id} className="storyboard-progress-step" data-complete={step.complete ? "true" : "false"}>
            <div className="storyboard-progress-bar">
              <span />
            </div>
            <p>{step.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

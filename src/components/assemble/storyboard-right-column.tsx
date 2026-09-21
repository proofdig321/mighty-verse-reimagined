"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimelineMs } from "@/lib/media/timing";
import { secondsFromMs } from "@/lib/media/timing";
import { jobUiLabel, generationProviderLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { motionRequirement } from "@/lib/storyboard/panel-state";
import { cameraEvidenceStatus, evidenceStatusLabel } from "@/lib/media/cinematic-evidence";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import type { StoryboardPanelRecord } from "@/lib/storyboard/document";
import type { GenerationJobKind } from "@/lib/ai/jobs";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

type JobCard = {
  job_id: string;
  kind: string;
  status: string;
  progress: number | null;
  error: { message?: string } | null;
  result: { still_url?: string; endpoint_ref?: string; playback_id?: string; provider_video_uri?: string | null; has_audio?: boolean | null } | null;
  panel_id: string | null;
  retryable: boolean;
};

type SelectedPanel = {
  title: string;
  description: string;
  time: string | null;
  kind: string;
  still: string | null;
  camera: string | null;
  movement: string | null;
  transition: string | null;
  endpoint: string | null;
};

export function StoryboardRightColumn({
  selected,
  selectedPersisted,
  editorPanel,
  draftPanel,
  selectedObservation,
  selectedFrame,
  mediaState,
  stillJob,
  motionJob,
  selectedJob,
  stillReady,
  motionReady,
  motionKind,
  firstFrame,
  lastFrame,
  durationSeconds,
  aspectRatio,
  activeReferenceUrls,
  references,
  workFrames,
  onDraftChange,
  onSavePanel,
  onGenerateStill,
  onEnqueue,
  onSetFirstFrame,
  onSetLastFrame,
  onSetDuration,
  onSetAspect,
  onRetryJob,
  onCancelJob,
  onManageReferences,
  onManageSentinel,
}: {
  selected: SelectedPanel | null;
  selectedPersisted: StoryboardPanelRecord | null;
  editorPanel: Partial<StoryboardPanelRecord>;
  draftPanel: Partial<StoryboardPanelRecord>;
  selectedObservation: NonNullable<StoryboardPanelRecord["generation_metadata"]>["sentinel_observation"] | null;
  selectedFrame: { source_title: string; timestamp_ms: number } | null;
  mediaState: GenerationState;
  stillJob: JobCard | null;
  motionJob: JobCard | null;
  selectedJob: JobCard | null;
  stillReady: { available: boolean; reason: string | null };
  motionReady: { available: boolean; reason: string | null };
  motionKind: GenerationJobKind;
  firstFrame: string;
  lastFrame: string;
  durationSeconds: 4 | 6 | 8;
  aspectRatio: "16:9" | "9:16";
  activeReferenceUrls: string[];
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  workFrames: { source_title: string; timestamp_ms: number; still_url: string; panel_id: string | null }[];
  onDraftChange: (patch: Partial<StoryboardPanelRecord>) => void;
  onSavePanel: () => void;
  onGenerateStill: () => void;
  onEnqueue: (kind: GenerationJobKind, extra?: Record<string, unknown>) => void;
  onSetFirstFrame: (url: string) => void;
  onSetLastFrame: (url: string) => void;
  onSetDuration: (v: 4 | 6 | 8) => void;
  onSetAspect: (v: "16:9" | "9:16") => void;
  onRetryJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onManageReferences: () => void;
  onManageSentinel: () => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [realizationMode, setRealizationMode] = useState<"still" | "motion">("still");

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No panel selected</p>
          <p className="mt-1 text-xs text-muted-foreground">Select a panel from the Storyboard Outline.</p>
        </div>
      </div>
    );
  }

  const panelReferenceCount = (selectedPersisted?.references ?? []).length + workFrames.length;
  const workReferenceCount = references.filter((r) => r.still_url).length;
  const observationCount = selectedObservation ? 1 : 0;

  return (
    <div className="flex flex-col gap-5 min-h-0 overflow-y-auto">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Storyboard Panel
        </p>
        <h2 className="text-base font-medium text-foreground leading-snug">{selected.title}</h2>
        {selected.time && (
          <p className="font-mono text-xs text-muted-foreground">{selected.time}</p>
        )}
        <p className="text-[10px] text-muted-foreground">{selected.kind}</p>
      </div>

      {/* Artifact preview */}
      {selected.endpoint ? (
        <StoryboardHlsPreview endpoint={selected.endpoint} poster={selected.still} label={`${selected.title} motion preview`} />
      ) : selected.still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selected.still} alt="" className="aspect-video w-full rounded object-cover" />
      ) : (
        <div className="aspect-video w-full rounded bg-muted/30" />
      )}

      {/* 1. INTENT */}
      <section aria-labelledby="panel-intent-heading">
        <p id="panel-intent-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Intent
        </p>
        {selectedPersisted ? (
          <div className="space-y-2">
            <Label htmlFor="panel-directive" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Creator Directive
            </Label>
            <Textarea
              id="panel-directive"
              className="min-h-[5rem] text-sm resize-none"
              value={editorPanel.generation_metadata?.transformation_instruction ?? ""}
              onChange={(e) =>
                onDraftChange({
                  ...selectedPersisted,
                  ...draftPanel,
                  panel_id: selectedPersisted.panel_id,
                  generation_metadata: {
                    ...selectedPersisted.generation_metadata,
                    ...draftPanel.generation_metadata,
                    transformation_instruction: e.target.value,
                  },
                })
              }
              placeholder="Describe what you want to create or change. This is creative direction, not a Sentinel observation."
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="panel-title-field" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Title</Label>
                <Input
                  id="panel-title-field"
                  className="h-7 text-sm mt-1"
                  value={editorPanel.title ?? ""}
                  onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="panel-narrative" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Narrative intent</Label>
                <Input
                  id="panel-narrative"
                  className="h-7 text-sm mt-1"
                  value={editorPanel.narrative_purpose ?? ""}
                  onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, narrative_purpose: e.target.value })}
                />
              </div>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Camera / framing / environment</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["camera", "camera_movement", "framing", "environment", "characters", "transition"] as const).map((field) => (
                  <div key={field}>
                    <Label htmlFor={`panel-${field}`} className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground capitalize">
                      {field.replace("_", " ")}
                    </Label>
                    <Input
                      id={`panel-${field}`}
                      className="h-7 text-sm mt-0.5"
                      value={(editorPanel[field] as string) ?? ""}
                      onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </details>
            <Button type="button" size="sm" variant="outline" onClick={onSavePanel}>
              Save panel
            </Button>
            {selectedPersisted.user_locked && (
              <p className="text-[10px] text-muted-foreground">Authored — AI will not overwrite this panel silently.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{selected.description}</p>
        )}
      </section>

      {/* 2. OBSERVED EVIDENCE */}
      <section aria-labelledby="panel-evidence-heading">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p id="panel-evidence-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Observed Evidence
          </p>
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setEvidenceOpen((v) => !v)}
          >
            {evidenceOpen ? "Collapse" : "View evidence"}
          </button>
        </div>
        {!evidenceOpen ? (
          <p className="text-xs text-muted-foreground">
            {observationCount > 0 || selectedFrame
              ? `${observationCount} Sentinel observation${observationCount !== 1 ? "s" : ""}${selectedFrame ? " · 1 frame attached" : ""}`
              : "No evidence attached."}
            {" "}
            <button type="button" className="underline underline-offset-2" onClick={onManageSentinel}>
              Manage Sentinel
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {selectedObservation ? (
              <div className="rounded-md border border-border/60 p-3 text-sm" data-source-reference="true">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Observed by Sentinel
                </p>
                <p className="font-medium">
                  {formatTimelineMs(selectedObservation.start_ms)} – {formatTimelineMs(selectedObservation.end_ms)}
                </p>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div><dt className="inline font-medium text-foreground">Subject </dt><dd className="inline">{selectedObservation.subjects || "Unknown"}</dd></div>
                  <div><dt className="inline font-medium text-foreground">Action </dt><dd className="inline">{selectedObservation.action}</dd></div>
                  <div>
                    <dt className="inline font-medium text-foreground">Camera </dt>
                    <dd className="inline">
                      {selectedObservation.camera_explanation || selectedObservation.camera} · {selectedObservation.framing} · {evidenceStatusLabel(cameraEvidenceStatus({ camera: selectedObservation.camera, camera_explanation: selectedObservation.camera_explanation, analysis_mode: selectedObservation.analysis_mode }))}
                    </dd>
                  </div>
                  <div><dt className="inline font-medium text-foreground">Confidence </dt><dd className="inline capitalize">{selectedObservation.confidence}</dd></div>
                </dl>
                <p className="mt-2 text-[10px] text-muted-foreground">Sentinel observation is kept when you edit authorised fields.</p>
              </div>
            ) : null}
            {selectedFrame ? (
              <div className="rounded-md border border-border/60 p-3 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Attached Frame</p>
                <p>{selectedFrame.source_title} · {formatTimelineMs(selectedFrame.timestamp_ms)}</p>
              </div>
            ) : null}
            {!selectedObservation && !selectedFrame && (
              <p className="text-xs text-muted-foreground">No evidence on this panel.</p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onManageSentinel}>
              Manage Sentinel
            </Button>
          </div>
        )}
      </section>

      {/* 3. REFERENCES */}
      <section aria-labelledby="panel-refs-heading">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p id="panel-refs-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            References
          </p>
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setRefsOpen((v) => !v)}
          >
            {refsOpen ? "Collapse" : "Manage references"}
          </button>
        </div>
        {!refsOpen ? (
          <p className="text-xs text-muted-foreground">
            {workReferenceCount + panelReferenceCount > 0
              ? `${workReferenceCount} work reference${workReferenceCount !== 1 ? "s" : ""} · ${panelReferenceCount} panel reference${panelReferenceCount !== 1 ? "s" : ""}`
              : "No references yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {workFrames.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Work references</p>
                <ul className="flex flex-wrap gap-2">
                  {workFrames.map((frame, i) => (
                    <li key={i} className="w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={frame.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{frame.source_title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(selectedPersisted?.references ?? []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Panel references</p>
                <ul className="flex flex-wrap gap-2">
                  {(selectedPersisted?.references ?? []).map((ref, i) => (
                    <li key={i} className="w-20">
                      {ref.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ref.url} alt="" className="aspect-video w-full rounded object-cover" />
                      ) : (
                        <div className="aspect-video rounded bg-muted/40" />
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{ref.label}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {references.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Work references (curated)</p>
                <ul className="flex flex-wrap gap-2">
                  {references.filter((r) => r.still_url).map((ref) => (
                    <li key={ref.asset_id} className="w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ref.still_url!} alt="" className="aspect-video w-full rounded object-cover" />
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{ref.title}</p>
                      <p className="text-[9px] text-muted-foreground">{secondsFromMs(ref.time_ms)}s</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onManageReferences}>
              + Add reference
            </Button>
          </div>
        )}
      </section>

      {/* 4. REALIZATION */}
      <section aria-labelledby="panel-realization-heading">
        <p id="panel-realization-heading" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Realization
        </p>

        {/* Mode toggle */}
        <Tabs value={realizationMode} onValueChange={(v) => setRealizationMode(v as "still" | "motion")} className="mb-3">
          <TabsList className="h-7">
            <TabsTrigger value="still" className="text-xs h-6">Still</TabsTrigger>
            <TabsTrigger value="motion" className="text-xs h-6">Motion</TabsTrigger>
          </TabsList>
        </Tabs>

        {realizationMode === "still" && (
          <div className="space-y-2">
            {stillJob && (stillJob.status === "failed" || stillJob.status === "unavailable" || stillJob.status === "blocked") && (
              <JobFailure job={stillJob} />
            )}
            <Button
              type="button"
              size="sm"
              onClick={onGenerateStill}
              disabled={!stillReady.available}
              title={stillReady.reason ?? "Generate still"}
            >
              Generate still
            </Button>
            {!stillReady.available && stillReady.reason && (
              <p className="text-xs text-muted-foreground">{stillReady.reason}</p>
            )}
            {selectedPersisted?.generation_metadata?.stills?.length ? (
              <ul className="grid grid-cols-2 gap-2 mt-2">
                {selectedPersisted.generation_metadata.stills.map((entry, i) => (
                  <li key={entry.asset_id}>
                    {entry.still_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                    ) : (
                      <div className="aspect-video rounded bg-muted/40" />
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Gen {i + 1} · {entry.status}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {realizationMode === "motion" && (
          <div className="space-y-2">
            {motionJob && (motionJob.status === "failed" || motionJob.status === "unavailable" || motionJob.status === "blocked") && (
              <JobFailure job={motionJob} />
            )}

            {/* Use still as first frame */}
            {selected.still && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.still} alt="" className="h-8 w-14 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">Use this still as the first frame</p>
                  <p className="text-[10px] text-muted-foreground">Feeds image-to-video generation</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={firstFrame === selected.still ? "default" : "outline"}
                  className="h-7 text-[10px] shrink-0"
                  onClick={() => onSetFirstFrame(firstFrame === selected.still ? "" : (selected.still ?? ""))}
                >
                  {firstFrame === selected.still ? "Set ✓" : "Set"}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-xs text-muted-foreground">
                Duration
                <select
                  aria-label="Duration"
                  className="ml-2 rounded border border-border bg-background px-2 py-0.5 text-foreground text-xs"
                  value={durationSeconds}
                  onChange={(e) => onSetDuration(Number(e.target.value) as 4 | 6 | 8)}
                >
                  <option value={4}>4s</option>
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Aspect
                <select
                  aria-label="Aspect ratio"
                  className="ml-2 rounded border border-border bg-background px-2 py-0.5 text-foreground text-xs"
                  value={aspectRatio}
                  onChange={(e) => onSetAspect(e.target.value === "9:16" ? "9:16" : "16:9")}
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>
              </label>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={!motionReady.available}
              title={motionReady.reason ?? "Generate Motion"}
              onClick={() => onEnqueue(motionKind)}
            >
              Generate Motion
            </Button>
            {!motionReady.available && motionReady.reason && (
              <p className="text-xs text-muted-foreground">{motionReady.reason}</p>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Advanced motion modes</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["motion", "animate-still", "first-last-frame", "reference-motion", "extend"] as const).map((kind) => {
                  const req = motionRequirement({
                    kind,
                    stillUrl: selected.still,
                    lastFrameUrl: lastFrame || null,
                    referenceUrls: activeReferenceUrls,
                    extensionVideoUri: selectedJob?.result?.provider_video_uri ?? null,
                  });
                  const labels: Record<string, string> = {
                    motion: "Text to video",
                    "animate-still": "Image to video",
                    "first-last-frame": "First / last frame",
                    "reference-motion": "Reference images",
                    extend: "Extend",
                  };
                  return (
                    <Button
                      key={kind}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      disabled={!req.available}
                      title={req.reason ?? labels[kind]}
                      onClick={() => onEnqueue(kind)}
                    >
                      {labels[kind]}
                    </Button>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {/* Job status */}
        {selectedJob && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground" data-generation-status={selectedJob.status}>
              {jobUiLabel(selectedJob.status as never)}
              {selectedJob.progress != null ? ` · ${selectedJob.progress}%` : ""}
            </p>
            <div className="flex gap-2">
              {(selectedJob.retryable || selectedJob.status === "failed" || selectedJob.status === "unavailable") && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onRetryJob(selectedJob.job_id)}>
                  Retry
                </Button>
              )}
              {(selectedJob.status === "queued" || selectedJob.status === "submitted" || selectedJob.status === "processing") && (
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onCancelJob(selectedJob.job_id)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {mediaState.status !== "idle" && (
          mediaState.status === "failed" || mediaState.status === "unavailable" || mediaState.status === "blocked" ? (
            <Alert variant="destructive" className="mt-2 py-2">
              <AlertCircle size={12} />
              <AlertDescription className="text-xs">{mediaState.message}</AlertDescription>
            </Alert>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground" data-generation-status={mediaState.status}>
              {mediaState.message}
            </p>
          )
        )}

        {/* Provenance */}
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Provenance</summary>
          <ol className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground">
            {selectedObservation && (
              <li>
                <span className="font-medium text-foreground">Sentinel </span>
                {formatTimelineMs(selectedObservation.start_ms)} – {formatTimelineMs(selectedObservation.end_ms)} · {selectedObservation.what_happens}
              </li>
            )}
            {selectedFrame && (
              <li>
                <span className="font-medium text-foreground">Frame </span>
                {selectedFrame.source_title} · {formatTimelineMs(selectedFrame.timestamp_ms)}
              </li>
            )}
            {selectedJob && (
              <li>
                <span className="font-medium text-foreground">Generation </span>
                {selectedJob.kind} · {jobUiLabel(selectedJob.status as never)}
                {selectedJob.result?.playback_id ? ` · Mux ${selectedJob.result.playback_id}` : ""}
              </li>
            )}
            <li><span className="font-medium text-foreground">Canonical </span>creates_scene = false</li>
          </ol>
        </details>
      </section>
    </div>
  );
}

function JobFailure({ job }: { job: JobCard }) {
  const copy = operatorGenerationMessage(job.error?.message);
  return (
    <Alert variant="destructive" className="py-2" data-generation-failure="true">
      <AlertCircle size={12} />
      <AlertDescription className="text-xs">
        <p>{copy.operator}</p>
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] opacity-70">Technical details</summary>
          <p className="mt-1 font-mono text-[10px] opacity-70">{copy.technical}</p>
        </details>
      </AlertDescription>
    </Alert>
  );
}

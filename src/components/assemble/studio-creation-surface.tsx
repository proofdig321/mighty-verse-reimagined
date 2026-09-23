"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Sparkles, Eye, EyeOff } from "lucide-react";
import { formatTimelineMs } from "@/lib/media/timing";
import { jobUiLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
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

export function StudioCreationSurface({
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
  capability,
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
  capability: { provider: string; configured: boolean; text?: boolean; image?: boolean; video?: boolean; label: string } | null;
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
}) {
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [panelDetailsOpen, setPanelDetailsOpen] = useState(false);

  const hasSentinel = Boolean(selectedObservation || selectedFrame);
  const hasRefs = references.filter((r) => r.still_url).length > 0 || workFrames.length > 0;
  const hasStill = Boolean(selected?.still);
  const hasMotion = Boolean(selected?.endpoint);
  const canTextToVideo = Boolean(capability?.video);
  const canImageToVideo = Boolean(capability?.video) && hasStill;
  const canGenerateStill = Boolean(capability?.image || capability?.text);

  return (
    <div className="studio-creation-surface">
      {/* ── Result / Preview area — grows to fill space ── */}
      <div className="studio-result-area">
        {hasMotion && selected?.endpoint ? (
          <StoryboardHlsPreview
            endpoint={selected.endpoint}
            poster={selected.still}
            label={`${selected.title} preview`}
          />
        ) : hasStill && selected?.still ? (
          <div className="relative w-full max-w-3xl rounded-xl overflow-hidden bg-muted/20 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.still} alt="" className="w-full aspect-video object-cover" />
            {selected.title && (
              <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-background/90 to-transparent">
                <p className="text-sm font-semibold text-foreground truncate">{selected.title}</p>
                {selected.time && <p className="font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
              </div>
            )}
          </div>
        ) : selected ? (
          <div className="relative w-full max-w-3xl aspect-video rounded-xl bg-card/40 border border-border/40 flex items-center justify-center">
            <div className="text-center px-6">
              <p className="text-base font-semibold text-foreground">{selected.title}</p>
              {selected.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{selected.description}</p>
              )}
              {selected.time && <p className="mt-2 font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl aspect-video rounded-xl border border-dashed border-border/30 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/60">Select a panel or create one to begin</p>
          </div>
        )}

        {/* Job status */}
        {selectedJob && (selectedJob.status === "queued" || selectedJob.status === "submitted" || selectedJob.status === "processing") && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground animate-pulse" data-generation-status={selectedJob.status}>
              {jobUiLabel(selectedJob.status as never)}
              {selectedJob.progress != null ? ` · ${selectedJob.progress}%` : ""}
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onCancelJob(selectedJob.job_id)}>Cancel</Button>
          </div>
        )}
        {selectedJob && (selectedJob.status === "failed" || selectedJob.status === "unavailable" || selectedJob.status === "blocked") && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-destructive">{operatorGenerationMessage(selectedJob.error?.message).operator}</span>
            {selectedJob.retryable && (
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onRetryJob(selectedJob.job_id)}>Retry</Button>
            )}
          </div>
        )}
      </div>

      {/* ── Composer — anchored at bottom ── */}
      <div className="studio-composer-wrap">
        {/* Sentinel advisory — collapsible */}
        {hasSentinel && (
          <div className="studio-sentinel-advisory mb-3">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/60 bg-card/60 hover:bg-card transition-colors text-left"
              onClick={() => setSentinelOpen((v) => !v)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sentinel Advisory</span>
                {selectedObservation && <Badge variant="outline" className="text-[9px] h-4 px-1">Evidence</Badge>}
              </div>
              {sentinelOpen ? <EyeOff size={12} className="text-muted-foreground shrink-0" /> : <Eye size={12} className="text-muted-foreground shrink-0" />}
            </button>
            {sentinelOpen && (
              <div className="mt-1 px-3 py-3 rounded-lg border border-border/60 bg-card/40 space-y-3">
                {selectedObservation && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Observed from source media</p>
                    <dl className="grid gap-1.5 text-xs">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-16 shrink-0">Timing</dt>
                        <dd className="font-mono text-foreground">{formatTimelineMs(selectedObservation.start_ms)} – {formatTimelineMs(selectedObservation.end_ms)}</dd>
                      </div>
                      {selectedObservation.subjects && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground w-16 shrink-0">Subject</dt>
                          <dd className="text-foreground">{selectedObservation.subjects}</dd>
                        </div>
                      )}
                      {selectedObservation.action && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground w-16 shrink-0">Movement</dt>
                          <dd className="text-foreground">{selectedObservation.action}</dd>
                        </div>
                      )}
                      {selectedObservation.camera && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground w-16 shrink-0">Camera</dt>
                          <dd className="text-foreground">{selectedObservation.camera_explanation || selectedObservation.camera}{selectedObservation.framing ? ` · ${selectedObservation.framing}` : ""}</dd>
                        </div>
                      )}
                      {selectedObservation.what_happens && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground w-16 shrink-0">Scene</dt>
                          <dd className="text-foreground line-clamp-2">{selectedObservation.what_happens}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-2 text-[10px] text-muted-foreground">Sentinel observes. It does not author creative meaning.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                        onClick={() => {
                          if (!selectedPersisted) return;
                          onDraftChange({
                            ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id,
                            generation_metadata: {
                              ...selectedPersisted.generation_metadata, ...draftPanel.generation_metadata,
                              transformation_instruction: [editorPanel.generation_metadata?.transformation_instruction, selectedObservation.action].filter(Boolean).join(". "),
                            },
                          });
                        }}
                      >Use as reference</Button>
                    </div>
                  </div>
                )}
                {selectedFrame && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">Attached frame</p>
                    <p className="text-xs text-foreground">{selectedFrame.source_title} · {formatTimelineMs(selectedFrame.timestamp_ms)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* References strip — collapsible */}
        {hasRefs && (
          <div className="mb-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground mb-2"
              onClick={() => setRefsOpen((v) => !v)}
            >
              References
              <span className="text-[9px] normal-case tracking-normal font-normal">
                {references.filter((r) => r.still_url).length + workFrames.length} attached
              </span>
            </button>
            {refsOpen && (
              <div className="flex flex-wrap gap-2">
                {workFrames.map((frame, i) => (
                  <div key={i} className="relative w-16 rounded overflow-hidden border border-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frame.still_url} alt="" className="aspect-video w-full object-cover" />
                    <p className="px-1 py-0.5 text-[9px] text-muted-foreground truncate bg-card/80">{frame.source_title}</p>
                  </div>
                ))}
                {references.filter((r) => r.still_url).map((ref) => (
                  <div key={ref.asset_id} className="relative w-16 rounded overflow-hidden border border-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.still_url!} alt="" className="aspect-video w-full object-cover" />
                    <p className="px-1 py-0.5 text-[9px] text-muted-foreground truncate bg-card/80">{ref.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Panel details — collapsible */}
        {selectedPersisted && (
          <div className="mb-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground mb-2"
              onClick={() => setPanelDetailsOpen((v) => !v)}
            >
              Panel details
            </button>
            {panelDetailsOpen && (
              <div className="space-y-2">
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Camera / framing / environment</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["camera", "camera_movement", "framing", "environment", "characters", "transition"] as const).map((field) => (
                      <div key={field}>
                        <label htmlFor={`panel-detail-${field}`} className="block text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5 capitalize">
                          {field.replace("_", " ")}
                        </label>
                        <input
                          id={`panel-detail-${field}`}
                          className="w-full h-7 rounded border border-input bg-background px-2 text-sm text-foreground"
                          value={(editorPanel[field] as string) ?? ""}
                          onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, [field]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </details>
                <Button type="button" size="sm" variant="outline" onClick={onSavePanel}>Save panel</Button>
                {selectedPersisted.user_locked && <p className="text-[10px] text-muted-foreground">Authored — AI will not overwrite this panel silently.</p>}
              </div>
            )}
          </div>
        )}

        {/* Directive textarea */}
        <div className="studio-composer">
          <Textarea
            className="studio-composer-input border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none p-0 text-sm placeholder:text-muted-foreground/60"
            value={editorPanel.generation_metadata?.transformation_instruction ?? ""}
            onChange={(e) => {
              if (!selectedPersisted) return;
              onDraftChange({
                ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id,
                generation_metadata: { ...selectedPersisted.generation_metadata, ...draftPanel.generation_metadata, transformation_instruction: e.target.value },
              });
            }}
            placeholder={selected ? `Describe what you want to create for "${selected.title}"…` : "Select a panel, then describe what you want to create…"}
          />

          <div className="studio-composer-bar mt-3">
            <div className="studio-composer-controls">
              <select
                aria-label="Aspect ratio"
                className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
                value={aspectRatio}
                onChange={(e) => onSetAspect(e.target.value === "9:16" ? "9:16" : "16:9")}
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
              {canTextToVideo && (
                <select
                  aria-label="Duration"
                  className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
                  value={durationSeconds}
                  onChange={(e) => onSetDuration(Number(e.target.value) as 4 | 6 | 8)}
                >
                  <option value={4}>4s</option>
                  <option value={6}>6s</option>
                  <option value={8}>8s</option>
                </select>
              )}
              {capability && <span className="text-[10px] text-muted-foreground px-1">{capability.label}</span>}
            </div>
            <div className="flex items-center gap-2">
              {canGenerateStill && (
                <Button type="button" size="sm" variant="outline" disabled={!stillReady.available} title={stillReady.reason ?? "Generate still"} onClick={onGenerateStill} className="h-8">Still</Button>
              )}
              {canTextToVideo && (
                <Button type="button" size="sm" disabled={!motionReady.available} title={motionReady.reason ?? "Generate"} onClick={() => onEnqueue(motionKind)} className="h-8 gap-1.5">
                  <Sparkles size={13} />Generate
                </Button>
              )}
              {!canTextToVideo && !canGenerateStill && (
                <Button type="button" size="sm" disabled={!stillReady.available} title={stillReady.reason ?? "Generate"} onClick={onGenerateStill} className="h-8 gap-1.5">
                  <Sparkles size={13} />Generate
                </Button>
              )}
            </div>
          </div>

          {canImageToVideo && hasStill && selected?.still && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.still} alt="" className="h-6 w-10 rounded object-cover border border-border/60" />
              <span>Image to video available</span>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onEnqueue("animate-still", { still_url: selected.still })}>Use still</Button>
            </div>
          )}

          {mediaState.status !== "idle" && (
            mediaState.status === "failed" || mediaState.status === "unavailable" || mediaState.status === "blocked" ? (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertCircle size={12} />
                <AlertDescription className="text-xs">{mediaState.message}</AlertDescription>
              </Alert>
            ) : mediaState.status === "ready" ? (
              <p className="mt-2 text-xs text-muted-foreground">{mediaState.message}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground animate-pulse" data-generation-status={mediaState.status}>{mediaState.message}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

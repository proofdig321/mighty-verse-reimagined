"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, EyeOff, Film, Layers, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimelineMs } from "@/lib/media/timing";
import { jobUiLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { StoryboardSourceMedia } from "./storyboard-source-media";
import { OutputFormatPicker } from "./output-format-picker";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import type { GenerationJobKind } from "@/lib/ai/jobs";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import type { SuiteScene } from "@/lib/assemble/suite";

type SurfaceView = "create" | "source" | "preview";

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

const VIEWS: { id: SurfaceView; label: string; icon: typeof Film }[] = [
  { id: "create", label: "Create", icon: Clapperboard },
  { id: "source", label: "Source", icon: Film },
  { id: "preview", label: "2.5D Preview", icon: Layers },
];

export function StudioCreationSurface({
  surfaceView,
  onSurfaceView,
  work,
  intelligence,
  previewHref,
  universeTitle,
  universeId,
  scenes,
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
  onWorkUpdate,
}: {
  surfaceView: SurfaceView;
  onSurfaceView: (v: SurfaceView) => void;
  work: StoryboardWorkRecord | null;
  intelligence: SentinelIntelligence | null;
  previewHref: string;
  universeTitle?: string | null;
  universeId: string | null;
  scenes: SuiteScene[];
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
  onWorkUpdate: (work: StoryboardWorkRecord) => void;
}) {
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [panelDetailsOpen, setPanelDetailsOpen] = useState(false);
  const [outputFormat, setOutputFormat] = useState<GenerationJobKind>("still");

  const hasSentinel = Boolean(selectedObservation || selectedFrame);
  const hasRefs = references.filter((r) => r.still_url).length > 0 || workFrames.length > 0;
  const hasStill = Boolean(selected?.still);
  const hasMotion = Boolean(selected?.endpoint);

  function handleGenerate() {
    if (outputFormat === "still") {
      onGenerateStill();
    } else {
      const extra: Record<string, unknown> = {};
      if (outputFormat === "animate-still" && selected?.still) extra.still_url = selected.still;
      if (outputFormat === "first-last-frame") { extra.first_frame_url = firstFrame; extra.last_frame_url = lastFrame; }
      if (outputFormat === "reference-motion") extra.first_frame_url = firstFrame;
      if (outputFormat === "extend" && selectedJob?.result?.provider_video_uri) extra.extension_video_uri = selectedJob.result.provider_video_uri;
      onEnqueue(outputFormat, extra);
    }
  }

  const generateDisabled = (() => {
    if (outputFormat === "still") return !stillReady.available;
    if (outputFormat === "animate-still") return !hasStill;
    if (outputFormat === "first-last-frame") return !firstFrame || !lastFrame;
    if (outputFormat === "extend") return !selectedJob?.result?.provider_video_uri;
    return !motionReady.available;
  })();

  const generateTitle = (() => {
    if (outputFormat === "still") return stillReady.reason ?? undefined;
    if (outputFormat === "animate-still" && !hasStill) return "Generate a still first";
    if (outputFormat === "first-last-frame" && (!firstFrame || !lastFrame)) return "Select first and last frames";
    if (outputFormat === "extend" && !selectedJob?.result?.provider_video_uri) return "Generate a clip first to extend";
    return motionReady.reason ?? undefined;
  })();

  return (
    <div className="studio-creation-surface">
      {/* ── View switcher ── */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border/40">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSurfaceView(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors",
              surfaceView === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
        {intelligence?.storyboard && intelligence.storyboard.length > 0 && (
          <Badge variant="outline" className="ml-auto text-[9px] h-5 px-1.5">
            {intelligence.storyboard.length} Sentinel beats
          </Badge>
        )}
      </div>

      {/* ── Source view ── */}
      {surfaceView === "source" && (
        <div className="studio-result-area overflow-y-auto">
          <div className="w-full max-w-2xl">
            <StoryboardSourceMedia
              workId={work?.work_id ?? null}
              sources={work?.sources ?? []}
              frames={work?.frames ?? []}
              selectedPanelId={selectedPersisted?.panel_id ?? null}
              onWork={(w) => onWorkUpdate(w as StoryboardWorkRecord)}
            />
          </div>
        </div>
      )}

      {/* ── 2.5D Preview view ── */}
      {surfaceView === "preview" && (
        <div className="studio-result-area overflow-y-auto">
          <div className="w-full max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">2.5D Studio Preview</p>
              <a href={previewHref} className="text-xs text-primary hover:underline">Open full Experience →</a>
            </div>
            {intelligence?.holographic && intelligence.holographic.length > 0 ? (
              <div className="rounded-xl overflow-hidden border border-border/40">
                {/* Holographic stage rendered server-side via link — client preview uses stills grid */}
                <ol className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                  {intelligence.holographic.map((layer, i) => (
                    <li key={i} className="space-y-1">
                      {layer.still_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={layer.still_url} alt="" className="aspect-video w-full rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="aspect-video w-full rounded-lg bg-card/40 border border-border/30 suite-still-placeholder" />
                      )}
                      <p className="text-[10px] text-muted-foreground truncate">{layer.title ?? `Layer ${i + 1}`}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : scenes.length > 0 ? (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {scenes.map((scene, i) => (
                  <li key={scene.master_id} className="space-y-1">
                    <div className="aspect-video w-full rounded-lg bg-card/40 border border-border/30 suite-still-placeholder" />
                    <p className="text-[10px] text-muted-foreground truncate">Scene {String(i + 1).padStart(2, "0")}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="aspect-video w-full rounded-xl border border-dashed border-border/30 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Layers size={24} className="mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">Add source media and run Sentinel to generate 2.5D layers</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => onSurfaceView("source")}>Add source media</Button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              2.5D composition uses canonical stills. Sentinel evidence informs layers; it does not create Scenes.
              <a href={previewHref} className="ml-2 text-primary hover:underline">Full holographic Experience →</a>
            </p>
          </div>
        </div>
      )}

      {/* ── Create view ── */}
      {surfaceView === "create" && (
        <>
          {/* Result / Preview area — grows */}
          <div className="studio-result-area">
            {hasMotion && selected?.endpoint ? (
              <StoryboardHlsPreview endpoint={selected.endpoint} poster={selected.still} label={`${selected.title} preview`} />
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
                  {selected.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{selected.description}</p>}
                  {selected.time && <p className="mt-2 font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-3xl aspect-video rounded-xl border border-dashed border-border/30 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Clapperboard size={28} className="mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground/60">Select a panel or create one to begin</p>
                </div>
              </div>
            )}

            {/* Job status */}
            {selectedJob && (selectedJob.status === "queued" || selectedJob.status === "submitted" || selectedJob.status === "processing") && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground animate-pulse" data-generation-status={selectedJob.status}>
                  {jobUiLabel(selectedJob.status as never)}{selectedJob.progress != null ? ` · ${selectedJob.progress}%` : ""}
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

          {/* Composer — anchored at bottom */}
          <div className="studio-composer-wrap">
            {/* Sentinel advisory */}
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
                            <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Subject</dt><dd className="text-foreground">{selectedObservation.subjects}</dd></div>
                          )}
                          {selectedObservation.action && (
                            <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Movement</dt><dd className="text-foreground">{selectedObservation.action}</dd></div>
                          )}
                          {selectedObservation.camera && (
                            <div className="flex gap-2">
                              <dt className="text-muted-foreground w-16 shrink-0">Camera</dt>
                              <dd className="text-foreground">{selectedObservation.camera_explanation || selectedObservation.camera}{selectedObservation.framing ? ` · ${selectedObservation.framing}` : ""}</dd>
                            </div>
                          )}
                          {selectedObservation.what_happens && (
                            <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Scene</dt><dd className="text-foreground line-clamp-2">{selectedObservation.what_happens}</dd></div>
                          )}
                        </dl>
                        <p className="mt-2 text-[10px] text-muted-foreground">Sentinel observes. It does not author creative meaning.</p>
                        <div className="mt-2">
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

            {/* References strip */}
            {hasRefs && (
              <div className="mb-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground mb-2"
                  onClick={() => setRefsOpen((v) => !v)}
                >
                  References
                  <span className="text-[9px] normal-case tracking-normal font-normal">{references.filter((r) => r.still_url).length + workFrames.length} attached</span>
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

            {/* Panel details */}
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

            {/* Directive + generation */}
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

              <OutputFormatPicker
                selected={outputFormat}
                onSelect={setOutputFormat}
                capability={capability}
                hasStill={hasStill}
                hasMotion={hasMotion}
                aspectRatio={aspectRatio}
                onSetAspect={onSetAspect}
                durationSeconds={durationSeconds}
                onSetDuration={onSetDuration}
                firstFrame={firstFrame}
                lastFrame={lastFrame}
                onSetFirstFrame={onSetFirstFrame}
                onSetLastFrame={onSetLastFrame}
                onGenerate={handleGenerate}
                generateDisabled={generateDisabled}
                generateTitle={generateTitle}
                workFrames={workFrames}
              />

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
        </>
      )}
    </div>
  );
}

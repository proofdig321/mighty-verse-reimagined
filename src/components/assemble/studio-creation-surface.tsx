"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Eye, EyeOff, Film, Layers, Clapperboard, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimelineMs } from "@/lib/media/timing";
import { jobUiLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { StoryboardSourceMedia } from "./storyboard-source-media";
import { CreativeIntentPicker, resolveKind, intentAvailable } from "./creative-operation";
import type { CreativeIntent } from "./creative-operation";
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
  // ── State ──
  const [intent, setIntent] = useState<CreativeIntent>("still");
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [panelDetailsOpen, setPanelDetailsOpen] = useState(false);
  const [localFirstFrame, setLocalFirstFrame] = useState("");
  const [localLastFrame, setLocalLastFrame] = useState("");

  // ── Derived ──
  const hasStill = Boolean(selected?.still);
  const hasMotion = Boolean(selected?.endpoint);
  const hasSentinel = Boolean(selectedObservation || selectedFrame);
  const hasRefs = references.filter((r) => r.still_url).length > 0 || workFrames.length > 0;

  // Reference stills for reference-motion: gallery refs + work frames
  const referenceStillUrls = [
    ...references.map((r) => r.still_url).filter((u): u is string => Boolean(u)),
    ...workFrames.map((f) => f.still_url),
  ];

  // Extension URI from the most recent completed motion job
  const extensionVideoUri = selectedJob?.result?.provider_video_uri ?? null;

  // Resolve the actual kind from intent + available inputs
  const resolvedKind = resolveKind({
    intent,
    firstFrame: localFirstFrame || firstFrame || selected?.still || "",
    lastFrame: localLastFrame || lastFrame,
    referenceUrls: referenceStillUrls,
    extensionVideoUri,
  });

  // What the resolved kind means in plain language (shown under the picker)
  const kindHint: Record<string, string> = {
    "still": "Generates a single image frame",
    "motion": "Text-to-video via Veo",
    "animate-still": "Animates your still image",
    "first-last-frame": "Interpolates between first and last frame",
    "reference-motion": "Motion guided by your reference images",
    "extend": "Extends your existing clip",
    "animation": "Cinematic animation style via Veo",
    "gif": "Derives a looping GIF from existing motion or still",
    "reel": "Assembles a short-form reel from panel stills/clips",
  };

  // Generate readiness
  const isClipIntent = intent === "clip";
  const generateReady = (() => {
    if (intent === "still") return stillReady;
    if (resolvedKind === "animate-still") return { available: hasStill, reason: hasStill ? null : "Generate a still first, then animate it" };
    if (resolvedKind === "first-last-frame") {
      const ok = Boolean((localFirstFrame || firstFrame) && (localLastFrame || lastFrame));
      return { available: ok, reason: ok ? null : "Select a first frame and a last frame below" };
    }
    if (resolvedKind === "reference-motion") return { available: referenceStillUrls.length > 0, reason: referenceStillUrls.length > 0 ? null : "Add reference images via Source or Gallery" };
    if (resolvedKind === "extend") return { available: Boolean(extensionVideoUri), reason: extensionVideoUri ? null : "Generate a clip first, then extend it" };
    if (intent === "gif") return { available: hasStill || hasMotion, reason: (hasStill || hasMotion) ? null : "Generate a still or clip first" };
    if (intent === "reel") return { available: workFrames.length > 0 || hasStill, reason: (workFrames.length > 0 || hasStill) ? null : "Add source frames or generate stills first" };
    return motionReady;
  })();

  function handleGenerate() {
    if (intent === "still") {
      onGenerateStill();
      return;
    }
    const extra: Record<string, unknown> = {
      duration_seconds: durationSeconds,
      aspect_ratio: aspectRatio,
    };
    if (resolvedKind === "animate-still") {
      extra.still_url = selected?.still;
      extra.first_frame_url = selected?.still;
    }
    if (resolvedKind === "first-last-frame") {
      extra.first_frame_url = localFirstFrame || firstFrame || selected?.still;
      extra.last_frame_url = localLastFrame || lastFrame;
    }
    if (resolvedKind === "reference-motion") {
      extra.reference_urls = referenceStillUrls.slice(0, 3);
    }
    if (resolvedKind === "extend") {
      extra.extension_video_uri = extensionVideoUri;
    }
    if (intent === "gif") {
      extra.playback_id = motionJob?.result?.playback_id ?? selectedJob?.result?.playback_id ?? null;
      extra.still_url = selected?.still;
    }
    if (intent === "reel") {
      extra.still_urls = workFrames.map((f) => f.still_url);
      extra.playback_ids = [];
    }
    onEnqueue(resolvedKind, extra);
  }

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
          {/* RESULT AREA — grows to fill space */}
          <div className="studio-result-area">
            {hasMotion && selected?.endpoint ? (
              <div className="w-full max-w-3xl space-y-2">
                <StoryboardHlsPreview endpoint={selected.endpoint} poster={selected.still} label={`${selected.title} preview`} />
                {/* Extend action — surfaces from result, not from format picker */}
                {extensionVideoUri && intentAvailable("clip", capability) && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-muted-foreground">Clip ready</span>
                    <Button
                      type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                      onClick={() => { setIntent("clip"); onEnqueue("extend", { extension_video_uri: extensionVideoUri, duration_seconds: durationSeconds, aspect_ratio: aspectRatio }); }}
                    >Extend clip</Button>
                    <Button
                      type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                      onClick={() => onEnqueue("gif", { playback_id: motionJob?.result?.playback_id ?? selectedJob?.result?.playback_id, still_url: selected?.still })}
                    >Export GIF</Button>
                  </div>
                )}
              </div>
            ) : hasStill && selected?.still ? (
              <div className="relative w-full max-w-3xl rounded-xl overflow-hidden bg-muted/20 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.still} alt="" className="w-full aspect-video object-cover" />
                <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-background/90 to-transparent">
                  {selected.title && <p className="text-sm font-semibold text-foreground truncate">{selected.title}</p>}
                  {selected.time && <p className="font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
                  {/* Animate action — surfaces from result */}
                  {intentAvailable("clip", capability) && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button" size="sm" variant="outline" className="h-6 text-[10px] bg-background/60"
                        onClick={() => { setIntent("clip"); onEnqueue("animate-still", { still_url: selected.still, first_frame_url: selected.still, duration_seconds: durationSeconds, aspect_ratio: aspectRatio }); }}
                      >Animate still</Button>
                    </div>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="relative w-full max-w-3xl aspect-video rounded-xl bg-card/40 border border-border/40 flex items-center justify-center">
                <div className="text-center px-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">{selected.kind}</p>
                  <p className="text-base font-semibold text-foreground">{selected.title}</p>
                  {selected.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{selected.description}</p>}
                  {selected.time && <p className="mt-2 font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-3xl aspect-video rounded-xl border border-dashed border-border/30 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Clapperboard size={28} className="mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground/50">Select a panel to begin</p>
                </div>
              </div>
            )}

            {/* Job status inline with result */}
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

          {/* COMPOSER — anchored at bottom */}
          <div className="studio-composer-wrap space-y-3">

            {/* ── CONTEXT STRIP: panel + sentinel evidence ── */}
            <div className="flex flex-wrap items-start gap-3">
              {/* Panel context */}
              {selected && (
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {selected.kind === "Canonical Scene" ? "Scene" : "Panel"}
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">{selected.title}</p>
                  {selected.time && <p className="font-mono text-[10px] text-muted-foreground">{selected.time}</p>}
                </div>
              )}

              {/* Sentinel evidence — compact, collapsible */}
              {hasSentinel && (
                <div className="shrink-0">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:bg-card transition-colors text-left"
                    onClick={() => setSentinelOpen((v) => !v)}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sentinel</span>
                    {selectedObservation && <Badge variant="outline" className="text-[9px] h-4 px-1">Evidence</Badge>}
                    {sentinelOpen ? <ChevronUp size={10} className="text-muted-foreground" /> : <ChevronDown size={10} className="text-muted-foreground" />}
                  </button>
                </div>
              )}
            </div>

            {/* Sentinel evidence detail — only when open */}
            {hasSentinel && sentinelOpen && (
              <div className="px-3 py-3 rounded-lg border border-border/60 bg-card/40 space-y-2">
                {selectedObservation && (
                  <>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observed from source media — advisory only</p>
                    <dl className="grid gap-1 text-xs">
                      {selectedObservation.subjects && (
                        <div className="flex gap-2"><dt className="text-muted-foreground w-14 shrink-0">Subject</dt><dd className="text-foreground">{selectedObservation.subjects}</dd></div>
                      )}
                      {selectedObservation.action && (
                        <div className="flex gap-2"><dt className="text-muted-foreground w-14 shrink-0">Movement</dt><dd className="text-foreground">{selectedObservation.action}</dd></div>
                      )}
                      {selectedObservation.camera && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground w-14 shrink-0">Camera</dt>
                          <dd className="text-foreground">{selectedObservation.camera_explanation || selectedObservation.camera}{selectedObservation.framing ? ` · ${selectedObservation.framing}` : ""}</dd>
                        </div>
                      )}
                      {selectedObservation.what_happens && (
                        <div className="flex gap-2"><dt className="text-muted-foreground w-14 shrink-0">Scene</dt><dd className="text-foreground line-clamp-2">{selectedObservation.what_happens}</dd></div>
                      )}
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-14 shrink-0">Timing</dt>
                        <dd className="font-mono text-foreground">{formatTimelineMs(selectedObservation.start_ms)} – {formatTimelineMs(selectedObservation.end_ms)}</dd>
                      </div>
                    </dl>
                    <div className="flex items-center gap-2 pt-1">
                      <p className="text-[9px] text-muted-foreground flex-1">Sentinel observes. Creator decides.</p>
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
                  </>
                )}
                {selectedFrame && (
                  <p className="text-xs text-foreground">{selectedFrame.source_title} · {formatTimelineMs(selectedFrame.timestamp_ms)}</p>
                )}
              </div>
            )}

            {/* ── REFERENCES — compact visual strip ── */}
            {hasRefs && (
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground mb-1.5"
                  onClick={() => setRefsOpen((v) => !v)}
                >
                  References
                  <span className="text-[9px] normal-case tracking-normal font-normal opacity-60">
                    {references.filter((r) => r.still_url).length + workFrames.length}
                  </span>
                  {refsOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                </button>
                {refsOpen && (
                  <div className="flex flex-wrap gap-1.5">
                    {workFrames.map((frame, i) => (
                      <button
                        key={i}
                        type="button"
                        title={`${frame.source_title} · ${formatTimelineMs(frame.timestamp_ms)}`}
                        onClick={() => {
                          if (!localFirstFrame) { setLocalFirstFrame(frame.still_url); onSetFirstFrame(frame.still_url); }
                          else if (!localLastFrame) { setLocalLastFrame(frame.still_url); onSetLastFrame(frame.still_url); }
                        }}
                        className={cn(
                          "relative w-14 rounded overflow-hidden border transition-colors",
                          (localFirstFrame === frame.still_url || firstFrame === frame.still_url) ? "border-primary" :
                          (localLastFrame === frame.still_url || lastFrame === frame.still_url) ? "border-accent-mv" :
                          "border-border/50 hover:border-border"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={frame.still_url} alt="" className="aspect-video w-full object-cover" />
                        {(localFirstFrame === frame.still_url || firstFrame === frame.still_url) && (
                          <span className="absolute bottom-0 inset-x-0 text-center text-[8px] bg-primary/80 text-white">1st</span>
                        )}
                        {(localLastFrame === frame.still_url || lastFrame === frame.still_url) && (
                          <span className="absolute bottom-0 inset-x-0 text-center text-[8px] bg-accent/80 text-white">last</span>
                        )}
                      </button>
                    ))}
                    {references.filter((r) => r.still_url).map((ref) => (
                      <div key={ref.asset_id} className="relative w-14 rounded overflow-hidden border border-border/50" title={ref.title}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ref.still_url!} alt="" className="aspect-video w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PANEL DETAILS — collapsible ── */}
            {selectedPersisted && (
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                  onClick={() => setPanelDetailsOpen((v) => !v)}
                >
                  Panel details
                  {panelDetailsOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                </button>
                {panelDetailsOpen && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {(["camera", "camera_movement", "framing", "environment", "characters", "transition"] as const).map((field) => (
                        <div key={field}>
                          <label htmlFor={`pd-${field}`} className="block text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-0.5 capitalize">
                            {field.replace("_", " ")}
                          </label>
                          <input
                            id={`pd-${field}`}
                            className="w-full h-7 rounded border border-input bg-background px-2 text-xs text-foreground"
                            value={(editorPanel[field] as string) ?? ""}
                            onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, [field]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={onSavePanel}>Save panel</Button>
                      {selectedPersisted.user_locked && <p className="text-[9px] text-muted-foreground">Authored — AI will not overwrite silently.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DIRECTIVE — dominant creative input ── */}
            <div className="studio-composer">
              <Textarea
                className="studio-composer-input border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none p-0 text-sm placeholder:text-muted-foreground/50"
                value={editorPanel.generation_metadata?.transformation_instruction ?? ""}
                onChange={(e) => {
                  if (!selectedPersisted) return;
                  onDraftChange({
                    ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id,
                    generation_metadata: {
                      ...selectedPersisted.generation_metadata,
                      ...draftPanel.generation_metadata,
                      transformation_instruction: e.target.value,
                    },
                  });
                }}
                placeholder={
                  selected
                    ? `Describe what you want to create for "${selected.title}"…`
                    : "Select a panel, then describe what you want to create…"
                }
              />

              {/* ── GENERATION CONTROLS ── */}
              <div className="studio-composer-bar mt-2">
                {/* Left: intent picker + contextual controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <CreativeIntentPicker
                    selected={intent}
                    onSelect={setIntent}
                    capability={capability}
                  />

                  {/* Aspect ratio — always shown */}
                  <select
                    aria-label="Aspect ratio"
                    className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
                    value={aspectRatio}
                    onChange={(e) => onSetAspect(e.target.value === "9:16" ? "9:16" : "16:9")}
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>

                  {/* Duration — only for video intents */}
                  {(intent === "clip" || intent === "animation") && (
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

                  {/* Resolved kind hint — only when non-obvious */}
                  {intent === "clip" && resolvedKind !== "motion" && (
                    <span className="text-[9px] text-muted-foreground">{kindHint[resolvedKind]}</span>
                  )}

                  {/* Provider label */}
                  {capability && (
                    <span className="text-[9px] text-muted-foreground/60">{capability.provider}</span>
                  )}
                </div>

                {/* Right: generate button */}
                <Button
                  type="button"
                  size="sm"
                  disabled={!generateReady.available}
                  title={generateReady.reason ?? `Generate ${intent}`}
                  onClick={handleGenerate}
                  className="h-8 gap-1.5 shrink-0"
                >
                  <Sparkles size={13} />
                  {intent === "still" ? "Still" : intent === "clip" ? "Clip" : intent === "animation" ? "Animate" : intent === "gif" ? "GIF" : "Reel"}
                </Button>
              </div>

              {/* Generation state feedback */}
              {mediaState.status !== "idle" && (
                mediaState.status === "failed" || mediaState.status === "unavailable" || mediaState.status === "blocked" ? (
                  <Alert variant="destructive" className="mt-2 py-2">
                    <AlertCircle size={12} />
                    <AlertDescription className="text-xs">{mediaState.message}</AlertDescription>
                  </Alert>
                ) : mediaState.status === "ready" ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{mediaState.message}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground animate-pulse" data-generation-status={mediaState.status}>{mediaState.message}</p>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

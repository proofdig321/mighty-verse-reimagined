"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle, Film, Layers, Clapperboard, Sparkles,
  ChevronDown, ChevronUp, Plus, X, ImagePlus, Volume2, VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimelineMs } from "@/lib/media/timing";
import { jobUiLabel } from "@/lib/ai/jobs";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { StoryboardSourceMedia } from "./storyboard-source-media";
import {
  CreativeIntentPicker, resolveKind, intentAvailable,
  describeWorkflow, modeAvailable, clampVeoDuration, VEO_DURATIONS, PRESETS,
} from "./creative-operation";
import type { CreativeIntent, Capability, VeoDuration, CreativePreset } from "./creative-operation";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import type { GenerationJobKind } from "@/lib/ai/jobs";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { CinematicShot } from "@/lib/media/cinematic-evidence";

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
  result: {
    still_url?: string;
    endpoint_ref?: string;
    playback_id?: string;
    provider_video_uri?: string | null;
    has_audio?: boolean | null;
    asset_id?: string;
  } | null;
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
  { id: "preview", label: "2.5D", icon: Layers },
];

export function StudioCreationSurface({
  surfaceView, onSurfaceView, work, intelligence, previewHref,
  universeTitle, universeId, scenes, selected, selectedPersisted,
  editorPanel, draftPanel, selectedObservation, selectedFrame,
  mediaState, stillJob, motionJob, selectedJob, stillReady, motionReady,
  motionKind, firstFrame, lastFrame, durationSeconds, aspectRatio,
  activeReferenceUrls, references, workFrames, capability,
  cinematicShots,
  onDraftChange, onSavePanel, onGenerateStill, onEnqueue,
  onSetFirstFrame, onSetLastFrame, onSetDuration, onSetAspect,
  onRetryJob, onCancelJob, onWorkUpdate, onSaveArtifactToPanel,
}: {
  surfaceView: SurfaceView; onSurfaceView: (v: SurfaceView) => void;
  work: StoryboardWorkRecord | null; intelligence: SentinelIntelligence | null;
  previewHref: string; universeTitle?: string | null; universeId: string | null;
  scenes: SuiteScene[]; selected: SelectedPanel | null;
  selectedPersisted: StoryboardPanelRecord | null;
  editorPanel: Partial<StoryboardPanelRecord>; draftPanel: Partial<StoryboardPanelRecord>;
  selectedObservation: NonNullable<StoryboardPanelRecord["generation_metadata"]>["sentinel_observation"] | null;
  selectedFrame: { source_title: string; timestamp_ms: number } | null;
  mediaState: GenerationState; stillJob: JobCard | null; motionJob: JobCard | null;
  selectedJob: JobCard | null;
  stillReady: { available: boolean; reason: string | null };
  motionReady: { available: boolean; reason: string | null };
  motionKind: GenerationJobKind; firstFrame: string; lastFrame: string;
  durationSeconds: number; aspectRatio: "16:9" | "9:16";
  activeReferenceUrls: string[];
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  workFrames: { source_title: string; timestamp_ms: number; still_url: string; panel_id: string | null }[];
  capability: Capability & { provider?: string; label?: string; models?: { text: string; image: string; video: string } } | null;
  cinematicShots: CinematicShot[];
  onDraftChange: (patch: Partial<StoryboardPanelRecord>) => void; onSavePanel: () => void;
  onGenerateStill: () => void; onEnqueue: (kind: GenerationJobKind, extra?: Record<string, unknown>) => void;
  onSetFirstFrame: (url: string) => void; onSetLastFrame: (url: string) => void;
  onSetDuration: (v: VeoDuration) => void; onSetAspect: (v: "16:9" | "9:16") => void;
  onRetryJob: (jobId: string) => void; onCancelJob: (jobId: string) => void;
  onWorkUpdate: (work: StoryboardWorkRecord) => void;
  onSaveArtifactToPanel: (panelId: string, patch: { still_url?: string; asset_id?: string; endpoint_ref?: string; playback_id?: string }) => void;
}) {
  const [intent, setIntent] = useState<CreativeIntent>("still");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [panelDetailsOpen, setPanelDetailsOpen] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [localFirstFrame, setLocalFirstFrame] = useState("");
  const [localLastFrame, setLocalLastFrame] = useState("");
  const [editVideoUri, setEditVideoUri] = useState("");
  const [selectedRefUrls, setSelectedRefUrls] = useState<Set<string>>(new Set());

  function applyPreset(preset: CreativePreset) {
    if (activePreset === preset.id) {
      setActivePreset(null);
      return;
    }
    setActivePreset(preset.id);
    setIntent(preset.intent);
    if (preset.defaults.durationSeconds) onSetDuration(preset.defaults.durationSeconds);
    if (preset.defaults.aspectRatio) onSetAspect(preset.defaults.aspectRatio);
    if (preset.defaults.generateAudio !== undefined) setGenerateAudio(preset.defaults.generateAudio);
  }

  function toggleRef(url: string) {
    setSelectedRefUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) { next.delete(url); return next; }
      if (next.size >= 3) return prev;
      next.add(url);
      return next;
    });
  }

  const hasStill = Boolean(selected?.still);
  const hasMotion = Boolean(selected?.endpoint);
  const hasSentinel = Boolean(selectedObservation || selectedFrame);
  const referenceStillUrls = Array.from(selectedRefUrls);
  const extensionVideoUri = selectedJob?.result?.provider_video_uri ?? null;
  const effectiveFirstFrame = localFirstFrame || firstFrame || "";
  const effectiveLastFrame = localLastFrame || lastFrame || "";
  const effectiveEditUri = editVideoUri || extensionVideoUri || "";

  // Sentinel shots available as usable frames
  const sentinelFrames = cinematicShots
    .filter((s) => s.still_url)
    .map((s) => ({ url: s.still_url!, label: `Shot ${String(s.sequence).padStart(2, "0")} · ${formatTimelineMs(s.time_ms)}`, kind: "sentinel" as const }));

  const allRefThumbs = [
    ...workFrames.map((f) => ({ url: f.still_url, label: formatTimelineMs(f.timestamp_ms), kind: "frame" as const })),
    ...references.filter((r) => r.still_url).map((r) => ({ url: r.still_url!, label: r.title, kind: "gallery" as const })),
    ...sentinelFrames,
  ];

  const resolvedKind = resolveKind({
    intent,
    firstFrame: effectiveFirstFrame || selected?.still || "",
    lastFrame: effectiveLastFrame,
    referenceUrls: referenceStillUrls,
    extensionVideoUri,
    editVideoUri: effectiveEditUri || null,
  });

  const workflow = describeWorkflow({
    intent,
    hasFirstFrame: Boolean(effectiveFirstFrame || selected?.still),
    hasLastFrame: Boolean(effectiveLastFrame),
    hasReferences: referenceStillUrls.length > 0,
    hasExtensionVideo: Boolean(extensionVideoUri),
    hasEditVideo: Boolean(effectiveEditUri) && !extensionVideoUri,
  });

  const canExtend = Boolean(extensionVideoUri) && modeAvailable("video-extension", capability);
  const canEdit = modeAvailable("text-to-video", capability); // Veo supports editing when configured
  const canFirstLast = modeAvailable("first-last-frame", capability);
  const canReference = modeAvailable("reference-images", capability);
  const canAudio = modeAvailable("text-to-video", capability); // audio is a Veo parameter

  const veoDuration = clampVeoDuration(durationSeconds);
  const isVideoIntent = intent === "clip" || intent === "animation";

  const generateReady = (() => {
    if (intent === "still") return stillReady;
    if (resolvedKind === "animate-still") return { available: hasStill, reason: hasStill ? null : "Generate or select a still first" };
    if (resolvedKind === "first-last-frame") {
      const ok = Boolean(effectiveFirstFrame && effectiveLastFrame);
      return { available: ok, reason: ok ? null : "Select a first and last frame" };
    }
    if (resolvedKind === "reference-motion") return { available: referenceStillUrls.length > 0, reason: referenceStillUrls.length > 0 ? null : "Add at least one reference" };
    if (resolvedKind === "extend") return { available: Boolean(extensionVideoUri), reason: extensionVideoUri ? null : "Generate a clip first" };
    if (resolvedKind === "edit") return { available: Boolean(effectiveEditUri), reason: effectiveEditUri ? null : "Paste a video URI to edit" };
    if (intent === "gif") return { available: hasStill || hasMotion, reason: (hasStill || hasMotion) ? null : "Generate a still or clip first" };
    if (intent === "reel") return { available: workFrames.length > 0 || hasStill, reason: (workFrames.length > 0 || hasStill) ? null : "Add source frames first" };
    return motionReady;
  })();

  function handleGenerate() {
    if (intent === "still") { onGenerateStill(); return; }
    const extra: Record<string, unknown> = {
      duration_seconds: veoDuration,
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio,
    };
    if (resolvedKind === "animate-still") { extra.still_url = selected?.still; extra.first_frame_url = selected?.still; }
    if (resolvedKind === "first-last-frame") { extra.first_frame_url = effectiveFirstFrame || selected?.still; extra.last_frame_url = effectiveLastFrame; }
    if (resolvedKind === "reference-motion") { extra.reference_urls = referenceStillUrls.slice(0, 3); }
    if (resolvedKind === "extend") { extra.extension_video_uri = extensionVideoUri; }
    if (resolvedKind === "edit") { extra.edit_video_uri = effectiveEditUri; }
    if (intent === "gif") { extra.playback_id = motionJob?.result?.playback_id ?? selectedJob?.result?.playback_id ?? null; extra.still_url = selected?.still; }
    if (intent === "reel") { extra.still_urls = workFrames.map((f) => f.still_url); extra.playback_ids = []; }
    onEnqueue(resolvedKind, extra);
  }

  const generateLabel = intent === "still" ? "Image" : intent === "clip" ? "Video" : intent === "animation" ? "Animate" : intent === "gif" ? "GIF" : "Reel";

  return (
    <div className="studio-creation-surface">

      {/* View tabs */}
      <div className="studio-view-tabs">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onSurfaceView(id)}
            className={cn("studio-view-tab", surfaceView === id && "studio-view-tab-active")}>
            <Icon size={12} />{label}
          </button>
        ))}
        {universeTitle && (
          <span className="suite-kicker ml-auto normal-case tracking-normal font-normal truncate max-w-[12rem]">{universeTitle}</span>
        )}
      </div>

      {/* Source view */}
      {surfaceView === "source" && (
        <div className="studio-result-area">
          <div className="w-full max-w-2xl">
            <StoryboardSourceMedia
              workId={work?.work_id ?? null} sources={work?.sources ?? []}
              frames={work?.frames ?? []} selectedPanelId={selectedPersisted?.panel_id ?? null}
              onWork={(w) => onWorkUpdate(w as StoryboardWorkRecord)}
            />
          </div>
        </div>
      )}

      {/* 2.5D Preview view */}
      {surfaceView === "preview" && (
        <div className="studio-result-area">
          <div className="w-full max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="suite-kicker">2.5D Preview</p>
              <a href={previewHref} className="text-xs text-primary hover:underline">Full Experience →</a>
            </div>
            {intelligence?.holographic && intelligence.holographic.length > 0 ? (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {intelligence.holographic.map((layer, i) => (
                  <li key={i} className="space-y-1">
                    {layer.still_url
                      ? <img src={layer.still_url} alt="" className="aspect-video w-full rounded-lg object-cover border border-border/40" />
                      : <div className="aspect-video w-full rounded-lg bg-card/40 border border-border/30" />}
                    <p className="suite-kicker normal-case tracking-normal font-normal truncate">{layer.title ?? `Layer ${i + 1}`}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-border/30 p-8 flex flex-col items-center gap-3 text-center">
                <Layers size={24} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Add source media and run Sentinel to generate 2.5D layers</p>
                <Button type="button" size="sm" variant="outline" onClick={() => onSurfaceView("source")}>Add source media</Button>
              </div>
            )}
            <p className="suite-kicker normal-case tracking-normal font-normal">
              Sentinel evidence informs layers — it does not create Scenes.{" "}
              <a href={previewHref} className="text-primary hover:underline">Full Experience →</a>
            </p>
          </div>
        </div>
      )}

      {/* Create view */}
      {surfaceView === "create" && (
        <>
          {/* COMPOSER */}
          <div className="studio-composer-wrap">

            {/* Context header */}
            <div className="studio-context-header">
              {selected ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="suite-kicker shrink-0">{selected.kind === "Canonical Scene" ? "Scene" : "Panel"}</span>
                  <span className="text-xs font-medium text-foreground truncate">{selected.title}</span>
                  {selected.time && (
                    <span className="font-mono suite-kicker shrink-0 normal-case tracking-normal font-normal">{selected.time}</span>
                  )}
                  <button type="button"
                    className="suite-kicker normal-case tracking-normal font-normal text-primary hover:underline ml-1 shrink-0"
                    onClick={() => setPanelDetailsOpen((v) => !v)}>
                    {panelDetailsOpen ? "Hide" : "Details"}
                  </button>
                </div>
              ) : (
                <span className="suite-kicker">No panel selected</span>
              )}
              {hasSentinel && (
                <button type="button"
                  className={cn("studio-sentinel-btn", sentinelOpen && "studio-sentinel-btn-open")}
                  onClick={() => setSentinelOpen((v) => !v)}>
                  Sentinel
                  {sentinelOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                </button>
              )}
            </div>

            {/* Panel details */}
            {panelDetailsOpen && selectedPersisted && (
              <div className="studio-panel-details">
                <div className="grid grid-cols-2 gap-2">
                  {(["camera","camera_movement","framing","environment","characters","transition"] as const).map((field) => (
                    <div key={field}>
                      <label htmlFor={`pd-${field}`} className="block suite-kicker mb-0.5 capitalize">{field.replace("_"," ")}</label>
                      <input id={`pd-${field}`}
                        className="w-full h-7 rounded border border-input bg-background px-2 text-xs text-foreground"
                        value={(editorPanel[field] as string) ?? ""}
                        onChange={(e) => onDraftChange({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, [field]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={onSavePanel}>Save</Button>
                  {selectedPersisted.user_locked && <p className="suite-kicker normal-case tracking-normal font-normal">Authored — AI will not overwrite.</p>}
                </div>
              </div>
            )}

            {/* Sentinel evidence — advisory, with usable material */}
            {hasSentinel && sentinelOpen && (
              <div className="studio-sentinel-detail">
                <p className="suite-kicker mb-2">Sentinel evidence — advisory only</p>
                {selectedObservation && (
                  <dl className="grid gap-1 text-xs mb-3">
                    {selectedObservation.subjects && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Subject</dt><dd className="text-foreground">{selectedObservation.subjects}</dd></div>
                    )}
                    {selectedObservation.action && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Movement</dt><dd className="text-foreground">{selectedObservation.action}</dd></div>
                    )}
                    {selectedObservation.camera && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Camera</dt><dd className="text-foreground">{selectedObservation.camera_explanation || selectedObservation.camera}</dd></div>
                    )}
                    {selectedObservation.what_happens && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-16 shrink-0">Scene</dt><dd className="text-foreground line-clamp-2">{selectedObservation.what_happens}</dd></div>
                    )}
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-16 shrink-0">Timing</dt>
                      <dd className="font-mono text-foreground">{formatTimelineMs(selectedObservation.start_ms)} – {formatTimelineMs(selectedObservation.end_ms)}</dd>
                    </div>
                  </dl>
                )}
                {selectedFrame && (
                  <p className="text-xs text-foreground mb-2">{selectedFrame.source_title} · {formatTimelineMs(selectedFrame.timestamp_ms)}</p>
                )}
                {/* Cinematic shots as usable frames */}
                {cinematicShots.length > 0 && (
                  <div className="mb-3">
                    <p className="suite-kicker mb-1.5">Frames — select to use as reference</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cinematicShots.filter((s) => s.still_url).slice(0, 12).map((shot) => {
                        const isFirst = effectiveFirstFrame === shot.still_url;
                        const isLast = effectiveLastFrame === shot.still_url;
                        const isRef = selectedRefUrls.has(shot.still_url!);
                        return (
                          <button key={shot.shot_id} type="button"
                            title={`Shot ${shot.sequence} · ${formatTimelineMs(shot.time_ms)} — ${shot.what_happens}`}
                            onClick={() => {
                              const url = shot.still_url!;
                              if (!isRef && !isFirst && !isLast) { toggleRef(url); }
                              else if (isRef) { toggleRef(url); setLocalFirstFrame(url); onSetFirstFrame(url); }
                              else if (isFirst) { setLocalFirstFrame(""); onSetFirstFrame(""); setLocalLastFrame(url); onSetLastFrame(url); }
                              else { setLocalLastFrame(""); onSetLastFrame(""); }
                            }}
                            className={cn(
                              "relative w-12 aspect-video rounded overflow-hidden border-2 transition-all",
                              isFirst ? "border-primary" : isLast ? "border-accent-mv" : isRef ? "border-amber-400" : "border-border hover:border-foreground/40"
                            )}>
                            <img src={shot.still_url!} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 inset-x-0 text-center text-[8px] bg-black/60 text-white leading-tight">
                              {isFirst ? "start" : isLast ? "end" : isRef ? "ref" : String(shot.sequence).padStart(2,"0")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="suite-kicker flex-1">Creator decides.</p>
                  {selectedObservation && (
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                      onClick={() => {
                        if (!selectedPersisted) return;
                        onDraftChange({
                          ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id,
                          generation_metadata: {
                            ...selectedPersisted.generation_metadata, ...draftPanel.generation_metadata,
                            transformation_instruction: [editorPanel.generation_metadata?.transformation_instruction, selectedObservation.action].filter(Boolean).join(". "),
                          },
                        });
                        setSentinelOpen(false);
                      }}>
                      Use as directive
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Composer box */}
            <div className="studio-composer">

              {/* Intent + workflow label */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CreativeIntentPicker selected={intent} onSelect={setIntent} capability={capability} />
                <div className="flex items-center gap-2">
                  <span className="suite-kicker normal-case tracking-normal font-normal opacity-60">{workflow}</span>
                  {capability && <span className="suite-kicker normal-case tracking-normal font-normal">{(capability as { provider?: string }).provider}</span>}
                </div>
              </div>

              {/* Presets */}
              {capability?.configured && (
                <div className="flex flex-wrap gap-1">
                  {PRESETS.filter((p) => intentAvailable(p.intent, capability)).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full border text-[10px] font-medium transition-all",
                        activePreset === preset.id
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Directive */}
              <Textarea
                className="studio-composer-input border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-none p-0 text-sm placeholder:text-muted-foreground/40"
                value={editorPanel.generation_metadata?.transformation_instruction ?? ""}
                onChange={(e) => {
                  if (!selectedPersisted) return;
                  onDraftChange({
                    ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id,
                    generation_metadata: { ...selectedPersisted.generation_metadata, ...draftPanel.generation_metadata, transformation_instruction: e.target.value },
                  });
                }}
                placeholder={selected ? `Describe what you want to create for "${selected.title}"…` : "Describe what you want to create…"}
              />

              {/* Reference chips */}
              {allRefThumbs.length > 0 && (
                <div className="studio-ref-chips">
                  {allRefThumbs.slice(0, refsOpen ? undefined : 6).map((ref, i) => {
                    const isFirst = effectiveFirstFrame === ref.url;
                    const isLast = effectiveLastFrame === ref.url;
                    const isRef = selectedRefUrls.has(ref.url);
                    return (
                      <button key={i} type="button"
                        title={`${ref.label} — tap to select`}
                        onClick={() => {
                          if (!isRef && !isFirst && !isLast) { toggleRef(ref.url); }
                          else if (isRef) { toggleRef(ref.url); setLocalFirstFrame(ref.url); onSetFirstFrame(ref.url); }
                          else if (isFirst) { setLocalFirstFrame(""); onSetFirstFrame(""); setLocalLastFrame(ref.url); onSetLastFrame(ref.url); }
                          else { setLocalLastFrame(""); onSetLastFrame(""); }
                        }}
                        className={cn(
                          "studio-ref-chip",
                          isFirst ? "studio-ref-chip-first" : isLast ? "studio-ref-chip-last" : isRef ? "studio-ref-chip-selected" : ""
                        )}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ref.url} alt="" className="w-full h-full object-cover" />
                        {isFirst && <span className="studio-ref-chip-label">start</span>}
                        {isLast && <span className="studio-ref-chip-label">end</span>}
                        {isRef && !isFirst && !isLast && <span className="studio-ref-chip-label">ref</span>}
                      </button>
                    );
                  })}
                  {allRefThumbs.length > 6 && (
                    <button type="button" className="studio-ref-chip-more" onClick={() => setRefsOpen((v) => !v)}>
                      {refsOpen ? <X size={10} /> : <Plus size={10} />}
                      {refsOpen ? "" : `${allRefThumbs.length - 6}`}
                    </button>
                  )}
                  {selectedRefUrls.size > 0 && (
                    <span className="text-[9px] text-muted-foreground/50 self-center">{selectedRefUrls.size}/3 ref</span>
                  )}
                </div>
              )}

              {/* Add reference */}
              {allRefThumbs.length === 0 && (
                <button type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={() => onSurfaceView("source")}>
                  <ImagePlus size={13} />
                  Add reference from source media
                </button>
              )}

              {/* Contextual: use panel still as start frame */}
              {isVideoIntent && hasStill && selected?.still && !effectiveFirstFrame && (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.still} alt="" className="w-8 h-6 rounded object-cover shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1">Use panel image as start frame</p>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] shrink-0"
                    onClick={() => { setLocalFirstFrame(selected.still!); onSetFirstFrame(selected.still!); }}>
                    Set start
                  </Button>
                </div>
              )}

              {/* Contextual: extend */}
              {isVideoIntent && canExtend && extensionVideoUri && (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground flex-1">Generated clip available — extend it</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] shrink-0"
                    onClick={() => onEnqueue("extend", { extension_video_uri: extensionVideoUri, duration_seconds: veoDuration, aspect_ratio: aspectRatio, generate_audio: generateAudio })}>
                    Extend
                  </Button>
                </div>
              )}

              {/* Contextual: edit video — separate from extend */}
              {isVideoIntent && canEdit && extensionVideoUri && (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground flex-1">Edit this clip with a directive</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] shrink-0"
                    onClick={() => { setEditVideoUri(extensionVideoUri); setAdvancedOpen(true); }}>
                    Edit
                  </Button>
                </div>
              )}

              {/* Controls bar */}
              <div className="studio-composer-bar">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select aria-label="Aspect ratio" className="studio-control-pill"
                    value={aspectRatio} onChange={(e) => onSetAspect(e.target.value === "9:16" ? "9:16" : "16:9")}>
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                  </select>
                  {isVideoIntent && (
                    <select aria-label="Duration in seconds" className="studio-control-pill"
                      value={veoDuration}
                      onChange={(e) => onSetDuration(clampVeoDuration(Number(e.target.value)))}>
                      {VEO_DURATIONS.map((d) => (
                        <option key={d} value={d}>{d}s</option>
                      ))}
                    </select>
                  )}
                  {isVideoIntent && canAudio && (
                    <button type="button"
                      title={generateAudio ? "Generated audio on" : "Generated audio off"}
                      onClick={() => setGenerateAudio((v) => !v)}
                      className={cn("studio-control-pill gap-1", generateAudio && "border-primary/50 text-primary")}>
                      {generateAudio ? <Volume2 size={11} /> : <VolumeX size={11} />}
                      <span className="text-xs">Audio</span>
                    </button>
                  )}
                  {isVideoIntent && (
                    <button type="button"
                      className={cn("studio-control-pill text-xs", advancedOpen && "border-primary/50")}
                      onClick={() => setAdvancedOpen((v) => !v)}>
                      Advanced
                    </button>
                  )}
                </div>
                <Button type="button" size="sm"
                  disabled={!generateReady.available}
                  title={generateReady.reason ?? `Generate ${intent}`}
                  onClick={handleGenerate}
                  className="studio-generate-btn">
                  <Sparkles size={13} />
                  {generateLabel}
                </Button>
              </div>

              {/* Advanced controls */}
              {advancedOpen && isVideoIntent && (
                <div className="studio-advanced-controls">
                  {canFirstLast && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="suite-kicker mb-1">Start frame</p>
                        {effectiveFirstFrame ? (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={effectiveFirstFrame} alt="" className="w-12 h-8 rounded object-cover" />
                            <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => { setLocalFirstFrame(""); onSetFirstFrame(""); }}>Clear</button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/50">Select from references above</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="suite-kicker mb-1">End frame</p>
                        {effectiveLastFrame ? (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={effectiveLastFrame} alt="" className="w-12 h-8 rounded object-cover" />
                            <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground"
                              onClick={() => { setLocalLastFrame(""); onSetLastFrame(""); }}>Clear</button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/50">Select from references above</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Edit video URI input */}
                  {canEdit && (
                    <div>
                      <p className="suite-kicker mb-1">Edit video — source URI</p>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs text-foreground"
                          placeholder="gs://… or https://… video URI to edit"
                          value={editVideoUri}
                          onChange={(e) => setEditVideoUri(e.target.value)}
                        />
                        {editVideoUri && (
                          <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() => setEditVideoUri("")}>Clear</button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Write your edit directive in the prompt above.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Generation feedback */}
              {mediaState.status !== "idle" && (
                ["failed","unavailable","blocked"].includes(mediaState.status) ? (
                  <p className="text-xs text-destructive">{mediaState.message}</p>
                ) : mediaState.status === "ready" ? (
                  <p className="text-xs text-muted-foreground">{mediaState.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground animate-pulse" data-generation-status={mediaState.status}>{mediaState.message}</p>
                )
              )}
            </div>
          </div>

          {/* RESULT */}
          <div className="studio-result-area">
            {hasMotion && selected?.endpoint ? (
              <div className="studio-result-card">
                <StoryboardHlsPreview endpoint={selected.endpoint} poster={selected.still} label={`${selected.title} preview`} />
                {selectedJob?.result?.has_audio && (
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground px-0.5">
                    <Volume2 size={10} /> Generated audio included
                  </p>
                )}
                <div className="studio-result-actions">
                  {canExtend && extensionVideoUri && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => onEnqueue("extend", { extension_video_uri: extensionVideoUri, duration_seconds: veoDuration, aspect_ratio: aspectRatio, generate_audio: generateAudio })}>
                      Extend
                    </Button>
                  )}
                  {canEdit && extensionVideoUri && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => { setEditVideoUri(extensionVideoUri); setAdvancedOpen(true); }}>
                      Edit
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => onEnqueue("gif", { playback_id: motionJob?.result?.playback_id ?? selectedJob?.result?.playback_id, still_url: selected?.still })}>
                    Export GIF
                  </Button>
                  {selected.still && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { setLocalFirstFrame(selected.still!); onSetFirstFrame(selected.still!); }}>
                      Use as reference
                    </Button>
                  )}
                  {selectedPersisted && selectedJob?.result && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => {
                        const r = selectedJob.result!;
                        onSaveArtifactToPanel(selectedPersisted.panel_id, {
                          still_url: r.still_url,
                          asset_id: r.asset_id,
                          endpoint_ref: r.endpoint_ref,
                          playback_id: r.playback_id,
                        });
                      }}>
                      Save to panel
                    </Button>
                  )}
                </div>
              </div>
            ) : hasStill && selected?.still ? (
              <div className="studio-result-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.still} alt="" className="w-full aspect-video object-cover rounded-xl" />
                <div className="studio-result-actions">
                  {intentAvailable("clip", capability) && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => { setIntent("clip"); onEnqueue("animate-still", { still_url: selected.still, first_frame_url: selected.still, duration_seconds: veoDuration, aspect_ratio: aspectRatio, generate_audio: generateAudio }); }}>
                      Animate
                    </Button>
                  )}
                  {/* Variation: re-generate with same prompt + existing image as reference */}
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => {
                      toggleRef(selected.still!);
                      onGenerateStill();
                    }}>
                    Variation
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => { setLocalFirstFrame(selected.still!); onSetFirstFrame(selected.still!); }}>
                    Use as reference
                  </Button>
                  {selectedPersisted && stillJob?.result && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => {
                        const r = stillJob.result!;
                        onSaveArtifactToPanel(selectedPersisted.panel_id, { still_url: r.still_url, asset_id: r.asset_id });
                      }}>
                      Save to panel
                    </Button>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="studio-result-empty">
                <p className="suite-kicker mb-1">{selected.kind}</p>
                <p className="text-base font-semibold text-foreground">{selected.title}</p>
                {selected.description && <p className="mt-2 text-sm text-muted-foreground/70 line-clamp-3">{selected.description}</p>}
                {selected.time && <p className="mt-2 font-mono suite-kicker normal-case tracking-normal font-normal">{selected.time}</p>}
              </div>
            ) : (
              <div className="studio-result-empty">
                <Clapperboard size={24} className="mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground/40">Select a panel and describe what you want to create</p>
              </div>
            )}

            {selectedJob && ["queued","submitted","processing"].includes(selectedJob.status) && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground animate-pulse" data-generation-status={selectedJob.status}>
                  {jobUiLabel(selectedJob.status as never)}{selectedJob.progress != null ? ` · ${selectedJob.progress}%` : ""}
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onCancelJob(selectedJob.job_id)}>Cancel</Button>
              </div>
            )}
            {selectedJob && ["failed","unavailable","blocked"].includes(selectedJob.status) && (
              <div className="flex items-center gap-2 mt-3">
                <AlertCircle size={12} className="text-destructive shrink-0" />
                <span className="text-xs text-destructive">{operatorGenerationMessage(selectedJob.error?.message).operator}</span>
                {selectedJob.retryable && (
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onRetryJob(selectedJob.job_id)}>Try again</Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

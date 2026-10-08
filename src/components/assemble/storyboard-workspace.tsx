"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import { composeStoryboardBody, type StoryboardScriptPanel } from "@/lib/storyboard/script";
import type { CinematicAnalysis } from "@/lib/media/cinematic-evidence";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import { type GenerationJobKind } from "@/lib/ai/jobs";
import { cn } from "@/lib/utils";
import {
  emptyHistory,
  redoHistory,
  saveStatusLabel,
  undoHistory,
  type AuthoringSnapshot,
  type HistoryState,
} from "@/lib/storyboard/history";
import { motionGenerationReady, primaryMotionKind, stillGenerationReady } from "@/lib/storyboard/panel-state";
import { collectActiveReferenceUrls, resolveStoryboardSelection } from "@/lib/storyboard/selection";
import type { ResetScope } from "@/lib/storyboard/mutations";
import { StudioContextSidebar } from "./studio-context-sidebar";
import { StudioCreationSurface } from "./studio-creation-surface";
import { StoryboardAssemblyBar } from "./storyboard-assembly-bar";
import { StoryboardWorkspaceHeader } from "./storyboard-workspace-header";
import { StoryboardWorkspaceLayout } from "./storyboard-workspace-layout";
import { StoryboardWorkspaceDialogs } from "./storyboard-workspace-dialogs";
import { StoryboardPanelSlideshow } from "./storyboard-panel-slideshow";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WorkSourceWorkflow } from "./work-source-workflow";
import { buildStoryboardShotIds, resolveStoryboardEditorPanel } from "@/lib/storyboard/workspace-state";
import type { VeoDuration } from "./creative-operation";
import { useStoryboardJobLifecycle } from "./use-storyboard-job-lifecycle";
import { useStoryboardSentinelActions, type StoryboardMaterialTab } from "./use-storyboard-sentinel-actions";
import { useStoryboardGenerationOperations } from "./use-storyboard-generation-operations";
import type { StoryboardJobCard } from "./use-storyboard-job-lifecycle";
import { useStoryboardWorkspaceAutomation } from "./use-storyboard-workspace-automation";
import { useStoryboardPersistence } from "./use-storyboard-persistence";
import { useStoryboardAuthoringOperations } from "./use-storyboard-authoring-operations";
import { StoryboardStoryEditor } from "./storyboard-story-editor";
import type { WorkbenchPanel } from "./studio-workbench-nav";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

type StoryboardArtifactCard = {
  title: string;
  output_type: string;
  still_url: string | null;
  playback_id?: string | null;
  endpoint_ref?: string | null;
  status: string;
};

type JobCard = StoryboardJobCard;

type CapabilityCard = {
  provider: string;
  configured: boolean;
  text?: boolean;
  image?: boolean;
  video?: boolean;
  label: string;
  models?: { text: string; image: string; video: string };
  modes?: Record<string, { available: boolean; reason: string | null }>;
};

export function StoryboardWorkspace({
  universeId,
  universeTitle,
  scenes,
  intelligence,
  canAuthoriseSentinel,
  inspectHref,
  previewHref,
  establishHref,
  references,
  initialTab = "script",
  initialBody = "",
  initialCreativeIntent = "",
  artifacts = [],
  assistConfigured = false,
  universes = [],
  workId = null,
  backHref = "/studio/work",
  activePanel = "work",
  mobileView = false,
}: {
  universeId: string | null;
  universeTitle?: string | null;
  scenes: SuiteScene[];
  intelligence: SentinelIntelligence | null;
  canAuthoriseSentinel: boolean;
  inspectHref?: string | null;
  previewHref: string;
  establishHref?: string | null;
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  initialTab?: StoryboardMaterialTab;
  initialBody?: string;
  initialCreativeIntent?: string;
  artifacts?: StoryboardArtifactCard[];
  assistConfigured?: boolean;
  universes?: { master_id: string; title: string }[];
  workId?: string | null;
  backHref?: string;
  activePanel?: WorkbenchPanel;
  mobileView?: boolean;
}) {
  const router = useRouter();
  // tab kept for API compat (importSentinel, addCinematicReferences use setTab)
  const [tab, setTab] = useState<StoryboardMaterialTab>(initialTab);
  const [script, setScript] = useState(initialBody);
  const [work, setWork] = useState<StoryboardWorkRecord | null>(null);
  const [scriptPanels, setScriptPanels] = useState<StoryboardScriptPanel[]>(
    initialBody ? composeStoryboardBody(initialBody).panels : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState(initialCreativeIntent);
  const [saveState, setSaveState] = useState<GenerationState>({ status: "idle", message: "" });
  const [mediaState, setMediaState] = useState<GenerationState>({ status: "idle", message: "" });
  const [generated, setGenerated] = useState<StoryboardArtifactCard[]>(artifacts);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [panelStills, setPanelStills] = useState<Record<string, string>>({});
  const [pendingPanels, setPendingPanels] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const [draftPanel, setDraftPanel] = useState<Partial<StoryboardPanelRecord>>({});
  const [firstFrame, setFirstFrame] = useState("");
  const [capability, setCapability] = useState<CapabilityCard | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [workTitle, setWorkTitle] = useState(universeTitle ?? "Untitled storyboard");
  const [history, setHistory] = useState<HistoryState>(emptyHistory);
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [assemblyItems, setAssemblyItems] = useState<AuthoringSnapshot["assembly"]>([]);
  const [cinematic, setCinematic] = useState<CinematicAnalysis | null>(null);
  const [cinematicShotId, setCinematicShotId] = useState<string | null>(null);
  const savedSnapshot = useRef<AuthoringSnapshot | null>(null);
  const { retryJob, cancelJob } = useStoryboardJobLifecycle({ jobs, setJobs, setMediaState, setPanelStills });

  const persistedPanels = work?.panels ?? [];
  const sentinelPanels = intelligence?.storyboard ?? [];
  const selectedPersisted = persistedPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedSentinel = sentinelPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScript = scriptPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScene = scenes.find((scene) => scene.master_id === selectedId) ?? null;
  const selectedJob = jobs.find((job) => job.panel_id === selectedId && (job.status === "queued" || job.status === "submitted" || job.status === "processing")) ?? jobs.find((job) => job.panel_id === selectedId) ?? null;

  const persistence = useStoryboardPersistence({
    universeId, work, script, creativeIntent: instruction, workTitle,
    assemblyItems, history, selectedId, selectedPersisted,
    draftPanel, backHref,
    setWork, setWorkTitle, setScript, setAssemblyItems, setHistory,
    setSelectedId, setScriptPanels, setDraftPanel,
    setFirstFrame,
    setPanelStills, setCinematic, setCinematicShotId,
    setDirty, setSaveFailed, setSaveState, setMediaState,
    onSnapshot: (snapshot) => { savedSnapshot.current = snapshot; },
    onDeleted: (href) => { router.push(href); router.refresh(); },
  });
  const {
    applyWork, mutate, restoreFromSnapshot, saveBody,
    savePanelEdits, saveArtifactToPanel, confirmDeleteWorkspace,
    deleteOpen, setDeleteOpen, deleteBusy, deleteError,
  } = persistence;

  const generation = useStoryboardGenerationOperations({
    universeId, work, script, selectedId, selected: null,
    selectedPersisted, selectedJob, draftPanel, instruction,
    references, generated, workFrames: work?.frames ?? [],
    persistedPanels, scriptPanels, sentinelPanels, scenes, panelStills,
    saveBody,
    setJobs, setMediaState, setPanelStills, setPendingPanels, setSelectedId,
  });
  const authoring = useStoryboardAuthoringOperations({
    universeId,
    universeTitle,
    work,
    script,
    instruction,
    selectedId,
    selectedPersisted,
    references,
    assistConfigured,
    sentinelPanels,
    scenes,
    applyWork,
    setScript,
    setScriptPanels,
    setSelectedId,
    setDirty,
    setSaveState,
  });
  const sentinel = useStoryboardSentinelActions({
    universeId, work, sentinelPanels, selectedPersisted,
    cinematic, cinematicShotId, setCinematic, setCinematicShotId,
    mutate, applyWork, setSelectedId,
    setDraftPanel,
    setFirstFrame,
    setTab,
  });

  const selected = useMemo(
    () => resolveStoryboardSelection({
      selectedPersisted, selectedScript, selectedSentinel, selectedScene, panelStills,
    }),
    [selectedPersisted, selectedScript, selectedSentinel, selectedScene, panelStills],
  );

  useEffect(() => {
    void (async () => {
      const query = new URLSearchParams();
      if (universeId) query.set("universe_id", universeId);
      if (workId) query.set("work_id", workId);
      const response = await fetch(`/api/authority/storyboard?${query.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (payload.work) applyWork(payload.work, typeof payload.selected_panel_id === "string" ? payload.selected_panel_id : null);
      if (payload.cinematic) setCinematic(payload.cinematic);
      if (typeof payload.selected_shot_id === "string") setCinematicShotId(payload.selected_shot_id);
      if (Array.isArray(payload.jobs)) setJobs(payload.jobs);
      if (Array.isArray(payload.artifacts)) setGenerated(payload.artifacts);
      if (payload.capability) setCapability(payload.capability);
    })();
  }, [universeId, workId]);

  const cinematicShots = sentinel.cinematic?.shots ?? [];
  const selectedObservation = selectedPersisted?.generation_metadata?.sentinel_observation ?? null;
  const selectedFrame = (work?.frames ?? []).find((frame) => frame.panel_id === selectedId) ?? work?.frames?.[0] ?? null;
  const transformationInstruction = selectedPersisted?.generation_metadata?.transformation_instruction
    ?? (draftPanel.generation_metadata?.transformation_instruction ?? null);
  const shotIds = buildStoryboardShotIds({
    persistedPanels,
    scriptPanels,
    sentinelPanels,
    scenes,
  });

  useStoryboardWorkspaceAutomation({
    dirty,
    history,
    playing,
    script,
    workTitle,
    selectedId,
    selectedPersisted,
    shotIds,
    work,
    saveBody,
    restoreFromSnapshot,
    mutate,
    setInspectorOpen,
    setResetOpen,
    setSelectedId,
  });

  const editorPanel = resolveStoryboardEditorPanel({
    draftPanel: draftPanel,
    selectedPersisted,
  });
  const saveLabel = saveStatusLabel({
    dirty,
    saving: saveState.status === "generating",
    failed: saveFailed || saveState.status === "failed",
    offline: typeof navigator !== "undefined" && navigator.onLine === false,
  });
  const undoEntry = history.past[history.past.length - 1];
  const redoEntry = history.future[history.future.length - 1];
  const stillJob = jobs.find((job) => job.panel_id === selectedId && job.kind === "still");
  const motionJob = jobs.find((job) =>
    job.panel_id === selectedId &&
    (job.kind === "motion" || job.kind === "clip" || job.kind === "animation" || job.kind === "animate-still"),
  );
  const stillReady = stillGenerationReady({
    panelSelected: Boolean(selectedPersisted),
    hasObservation: Boolean(selectedObservation),
    hasReference: Boolean(selectedPersisted?.references.length || selectedFrame || (work?.frames?.length ?? 0)),
    hasDirective: Boolean((editorPanel.generation_metadata?.transformation_instruction || transformationInstruction || instruction).trim()),
  });
  const motionReady = motionGenerationReady({
    stillUrl: selected?.still,
    hasDirective: Boolean((editorPanel.generation_metadata?.transformation_instruction || transformationInstruction || instruction).trim()),
    hasReference: Boolean(references.some((item) => item.still_url) || (work?.frames?.length ?? 0)),
  });
  const motionKind = primaryMotionKind({ stillUrl: selected?.still });
  const activeReferenceUrls = useMemo(
    () => collectActiveReferenceUrls({
      references,
      workFrames: work?.frames ?? [],
      persistedPanels,
    }),
    [references, work?.frames, persistedPanels],
  );

  return (
    <div className={cn("storyboard-workspace multiverse-page", mobileView && "studio-workbench-mobile-sim")} data-storyboard-layout="workstation">
      {/* ── Top bar ── */}
      <StoryboardWorkspaceHeader
        universeId={universeId}
        backHref={backHref}
        workTitle={workTitle}
        saveLabel={saveLabel}
        workAttached={Boolean(work?.universe_id)}
        universes={universes}
        workId={work?.work_id ?? workId ?? null}
        undoDisabled={!undoEntry}
        redoDisabled={!redoEntry}
        deleteVisible={Boolean(work?.work_id)}
        onTitleChange={(value) => {
          setWorkTitle(value);
          setDirty(true);
        }}
        onUndo={() => {
          const next = undoHistory(history);
          if (next) void restoreFromSnapshot(next.entry.before, next.state);
        }}
        onRedo={() => {
          const next = redoHistory(history);
          if (next) void restoreFromSnapshot(next.entry.after, next.state);
        }}
        onReset={() => setResetOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onSave={() => void saveBody()}
      />
      <StoryboardWorkspaceDialogs
        resetOpen={resetOpen}
        deleteOpen={deleteOpen}
        deleteBusy={deleteBusy}
        deleteError={deleteError}
        workTitle={workTitle}
        workAttached={Boolean(work?.universe_id)}
        panelSelected={Boolean(selectedPersisted)}
        onResetClose={() => setResetOpen(false)}
        onResetConfirm={(scope: ResetScope) => {
          setResetOpen(false);
          if (scope === "unsaved" && savedSnapshot.current) {
            setScript(savedSnapshot.current.body);
            setWorkTitle(savedSnapshot.current.title);
            setDirty(false);
            return;
          }
          if (scope === "panel" && selectedPersisted) {
            setDraftPanel(selectedPersisted);
            return;
          }
          void mutate("Reset", "reset", { scope, panel_id: selectedPersisted?.panel_id });
        }}
        onDeleteClose={() => { if (!deleteBusy) setDeleteOpen(false); }}
        onDeleteConfirm={() => void confirmDeleteWorkspace()}
      />

      {/* ── Unified creative workspace ── */}
      <StoryboardWorkspaceLayout
        left={
          <StudioContextSidebar
            universeTitle={universeTitle}
            workId={work?.work_id ?? workId}
            activePanel={activePanel}
            mobileView={mobileView}
            workTitle={workTitle}
            persistedPanels={persistedPanels}
            sentinelPanels={sentinelPanels}
            scenes={scenes}
            selectedId={selectedId}
            panelStills={panelStills}
            pendingPanels={pendingPanels}
            jobs={jobs}
            onSelect={(id) => {
              setSelectedId(id);
              const panel = persistedPanels.find((p) => p.panel_id === id);
              if (panel) { setDraftPanel(panel); setFirstFrame(panel.still_url ?? ""); }
            }}
            onCreatePanel={() => void mutate("Create panel", "create-panel", {})}
            onReorder={(orderedIds) => void mutate("Reorder", "reorder-panels", { panel_ids: orderedIds })}
            onSourceOpen={work?.work_id ?? workId ? () => setSourceSheetOpen(true) : undefined}
          />
        }
        main={
          <StudioCreationSurface
            work={work}
            intelligence={intelligence}
            previewHref={previewHref}
            sourceHref={work?.work_id ?? workId ? `/studio/work/${work?.work_id ?? workId}/source` : "/studio/work"}
            universeTitle={universeTitle}
            universeId={universeId}
            scenes={scenes}
            selected={selected}
            selectedPersisted={selectedPersisted}
            editorPanel={editorPanel}
            draftPanel={draftPanel}
            selectedObservation={selectedObservation}
            selectedFrame={selectedFrame}
            mediaState={mediaState}
            stillJob={stillJob ?? null}
            motionJob={motionJob ?? null}
            selectedJob={selectedJob ?? null}
            stillReady={stillReady}
            motionReady={motionReady}
            motionKind={motionKind}
            firstFrame={generation.firstFrame}
            lastFrame={generation.lastFrame}
            durationSeconds={generation.durationSeconds}
            aspectRatio={generation.aspectRatio}
            resolution={generation.resolution}
            activeReferenceUrls={activeReferenceUrls}
            references={references}
            workFrames={work?.frames ?? []}
            capability={capability}
            cinematicShots={cinematicShots}
            composerHeader={
              <StoryboardStoryEditor
                script={script}
                instruction={instruction}
                hasPanels={persistedPanels.length > 0 || scriptPanels.length > 0}
                saveState={saveState}
                assistState={authoring.assistState}
                assistProposal={authoring.assistProposal}
                onScriptChange={(value) => { setScript(value); setDirty(true); }}
                onInstructionChange={(value) => { setInstruction(value); setDirty(true); }}
                onSave={() => void saveBody()}
                onGenerate={() => void authoring.generateStoryboard()}
                onAssist={(actionId) => void authoring.assist(actionId)}
                onApplyProposal={authoring.applyAssistProposal}
                onDismissProposal={authoring.dismissAssistProposal}
              />
            }
            onDraftChange={(patch) => setDraftPanel(patch)}
            onSavePanel={() => void savePanelEdits()}
            onGenerateStill={() => void generation.generateMedia("still")}
            onEnqueue={(kind, extra) => void generation.enqueue(kind, extra)}
            onSetFirstFrame={setFirstFrame}
            onSetLastFrame={generation.setLastFrame}
            onSetDuration={(v: VeoDuration) => generation.setDurationSeconds(v)}
            onSetAspect={generation.setAspectRatio}
            onSetResolution={generation.setResolution}
            onRetryJob={(jobId) => void retryJob(jobId)}
            onCancelJob={(jobId) => void cancelJob(jobId)}
            onSaveArtifactToPanel={(panelId, patch) => void saveArtifactToPanel(panelId, patch)}
            onSourceOpen={work?.work_id ?? workId ? () => setSourceSheetOpen(true) : undefined}
          />
        }
      />

      {/* ASSEMBLY — footer status bar */}
      <div className="flex-shrink-0">
        {slideshowOpen && persistedPanels.length > 0 && (
          <StoryboardPanelSlideshow
            panels={persistedPanels}
            panelStills={panelStills}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              const panel = persistedPanels.find((p) => p.panel_id === id);
              if (panel) { setDraftPanel(panel); setFirstFrame(panel.still_url ?? ""); }
            }}
            onClose={() => setSlideshowOpen(false)}
          />
        )}
        <StoryboardAssemblyBar
          assemblyItems={assemblyItems}
          panelCount={persistedPanels.length}
          universeId={universeId}
          canAddSelected={Boolean(selected)}
          onPreview={persistedPanels.length > 0 ? () => setSlideshowOpen((v) => !v) : undefined}
          onAddSelected={() => {
            if (!selected) return;
            const next = [...assemblyItems, {
              id: `${Date.now()}`,
              kind: selected.endpoint ? "motion" as const : "still" as const,
              label: selected.title,
              panel_id: selectedId,
              url: selected.still,
              playback_id: selectedJob?.result?.playback_id ?? null,
              endpoint: selected.endpoint,
            }];
            setAssemblyItems(next);
            void mutate("Save assembly", "save-assembly", { items: next });
          }}
        />
      </div>

      {/* Source sheet — Gap 4: inline source workflow instead of full navigation */}
      {(work?.work_id ?? workId) && (
        <Sheet open={sourceSheetOpen} onOpenChange={setSourceSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
              <SheetTitle>Source Media</SheetTitle>
            </SheetHeader>
            <div className="px-5 py-4">
              <WorkSourceWorkflow
                workId={(work?.work_id ?? workId)!}
                workTitle={workTitle}
                sources={work?.sources ?? []}
                frames={work?.frames ?? []}
                returnHref={`/studio/work/${work?.work_id ?? workId}`}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

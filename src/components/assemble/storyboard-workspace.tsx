"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { SentinelIntelligence, StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import { composeStoryboardBody, type StoryboardScriptPanel } from "@/lib/storyboard/script";
import { chromePromptAvailability, promptWithChrome, STORYBOARD_SYSTEM } from "@/lib/ai/chrome";
import {
  catalogForChrome,
  GALLERY_THEME_SYSTEM,
  parseChromeThemeMatch,
  pickGalleryTheme,
} from "@/lib/storyboard/gallery-theme";
import type { StoryboardOutputType } from "@/lib/storyboard/artifact";
import { ASSIST_ACTIONS } from "@/lib/storyboard/assist";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import { jobUiLabel, type GenerationJobKind } from "@/lib/ai/jobs";
import { StoryboardResetDialog } from "./storyboard-reset-dialog";
import { StoryboardDeleteDialog } from "./storyboard-delete-dialog";
import { curateHubHref } from "@/lib/assemble/studio";
import { cn } from "@/lib/utils";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { type CinematicAnalysis, type CinematicShot } from "@/lib/media/cinematic-evidence";
import {
  emptyHistory,
  historyStorageKey,
  parseHistory,
  pushHistory,
  redoHistory,
  saveStatusLabel,
  serializeHistory,
  undoHistory,
  workToSnapshot,
  type AuthoringSnapshot,
  type HistoryState,
} from "@/lib/storyboard/history";
import { motionGenerationReady, primaryMotionKind, stillGenerationReady } from "@/lib/storyboard/panel-state";
import type { ResetScope } from "@/lib/storyboard/mutations";
import { HierarchyBreadcrumb } from "./breadcrumb";
import { StudioContextSidebar } from "./studio-context-sidebar";
import { StudioCreationSurface } from "./studio-creation-surface";
import { StoryboardAssemblyBar } from "./storyboard-assembly-bar";
import { StoryboardSourceMedia } from "./storyboard-source-media";
import { deriveStoryboardProgress } from "@/lib/assemble/storyboard-progress";
import { studioPhaseForTab } from "@/lib/assemble/studio-interaction";

type MaterialTab = "script" | "assist" | "sentinel" | "references" | "panels" | "stills" | "motion" | "assembly";
type SurfaceView = "create" | "source" | "preview";
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

type CapabilityCard = {
  provider: string;
  configured: boolean;
  text?: boolean;
  image?: boolean;
  video?: boolean;
  label: string;
  models?: { text: string; image: string; video: string };
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
  artifacts = [],
  assistConfigured = false,
  universes = [],
  workId = null,
  backHref = "/studio/work",
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
  initialTab?: MaterialTab;
  initialBody?: string;
  artifacts?: StoryboardArtifactCard[];
  assistConfigured?: boolean;
  universes?: { master_id: string; title: string }[];
  workId?: string | null;
  backHref?: string;
}) {
  const router = useRouter();
  // tab kept for API compat (importSentinel, addCinematicReferences use setTab)
  const [tab, setTab] = useState<MaterialTab>(initialTab);
  const [script, setScript] = useState(initialBody);
  const [work, setWork] = useState<StoryboardWorkRecord | null>(null);
  const [scriptPanels, setScriptPanels] = useState<StoryboardScriptPanel[]>(
    initialBody ? composeStoryboardBody(initialBody).panels : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistState, setAssistState] = useState<GenerationState>({ status: "idle", message: "" });
  const [saveState, setSaveState] = useState<GenerationState>({ status: "idle", message: "" });
  const [mediaState, setMediaState] = useState<GenerationState>({ status: "idle", message: "" });
  const [generated, setGenerated] = useState<StoryboardArtifactCard[]>(artifacts);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [panelStills, setPanelStills] = useState<Record<string, string>>({});
  const [pendingPanels, setPendingPanels] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const [draftPanel, setDraftPanel] = useState<Partial<StoryboardPanelRecord>>({});
  const [firstFrame, setFirstFrame] = useState<string>("");
  const [lastFrame, setLastFrame] = useState<string>("");
  const [durationSeconds, setDurationSeconds] = useState<number>(8);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [capability, setCapability] = useState<CapabilityCard | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [generationPage, setGenerationPage] = useState(0);
  const [workTitle, setWorkTitle] = useState(universeTitle ?? "Untitled storyboard");
  const [history, setHistory] = useState<HistoryState>(emptyHistory);
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assistProposal, setAssistProposal] = useState<string | null>(null);
  const [assemblyItems, setAssemblyItems] = useState<AuthoringSnapshot["assembly"]>([]);
  const [cinematic, setCinematic] = useState<CinematicAnalysis | null>(null);
  const [cinematicShotId, setCinematicShotId] = useState<string | null>(null);
  const [bulkShotIds, setBulkShotIds] = useState<string[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [sentinelMessage, setSentinelMessage] = useState<string | null>(null);
  const [sentinelError, setSentinelError] = useState<string | null>(null);
  const [surfaceView, setSurfaceView] = useState<SurfaceView>("create");
  const savedSnapshot = useRef<AuthoringSnapshot | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  const persistedPanels = work?.panels ?? [];
  const sentinelPanels = intelligence?.storyboard ?? [];
  const selectedPersisted = persistedPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedSentinel = sentinelPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScript = scriptPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScene = scenes.find((scene) => scene.master_id === selectedId) ?? null;
  const selectedJob = jobs.find((job) => job.panel_id === selectedId && (job.status === "queued" || job.status === "submitted" || job.status === "processing")) ?? jobs.find((job) => job.panel_id === selectedId) ?? null;

  const selected = useMemo(() => {
    if (selectedPersisted) {
      return {
        title: selectedPersisted.title,
        description: selectedPersisted.description,
        time: selectedPersisted.duration_ms ? `${Math.round(selectedPersisted.duration_ms / 1000)}s` : null,
        kind: "Storyboard panel",
        still: panelStills[selectedPersisted.panel_id] ?? selectedPersisted.still_url,
        camera: selectedPersisted.camera,
        movement: selectedPersisted.camera_movement,
        transition: selectedPersisted.transition,
        endpoint: selectedPersisted.motion_endpoint,
      };
    }
    if (selectedScript) {
      return {
        title: selectedScript.title,
        description: selectedScript.description,
        time: null as string | null,
        kind: "Script beat",
        still: panelStills[selectedScript.panel_id] ?? null,
        camera: selectedScript.camera,
        movement: selectedScript.movement,
        transition: selectedScript.transition,
        endpoint: null as string | null,
      };
    }
    if (selectedSentinel) {
      return {
        title: selectedSentinel.title,
        description:
          selectedSentinel.kind === "scene"
            ? "Canonical Scene. Sentinel observed this window; it did not create the Scene."
            : "Sentinel evidence. A storyboard beat is not a Scene.",
        time: formatTimelineMs(selectedSentinel.time_ms),
        kind: selectedSentinel.kind === "scene" ? "Canonical Scene" : "Sentinel beat",
        still: panelStills[selectedSentinel.panel_id] ?? selectedSentinel.still_url,
        camera: null,
        movement: null,
        transition: null,
        endpoint: null as string | null,
      };
    }
    if (selectedScene) {
      return {
        title: sceneShortTitle(selectedScene.title) ?? selectedScene.title ?? "Untitled scene",
        description: selectedScene.description ?? "Canonical Scene window.",
        time:
          selectedScene.start_ms != null && selectedScene.end_ms != null
            ? `${formatTimelineMs(selectedScene.start_ms)} → ${formatTimelineMs(selectedScene.end_ms)}`
            : null,
        kind: "Canonical Scene",
        still: panelStills[selectedScene.master_id] ?? null,
        camera: null,
        movement: null,
        transition: null,
        endpoint: null as string | null,
      };
    }
    return null;
  }, [selectedPersisted, selectedScript, selectedSentinel, selectedScene, panelStills]);

  useEffect(() => {
    void (async () => {
      const query = new URLSearchParams();
      if (universeId) query.set("universe_id", universeId);
      if (workId) query.set("work_id", workId);
      const response = await fetch(`/api/authority/storyboard?${query.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (payload.work) {
        applyWork(payload.work, typeof payload.selected_panel_id === "string" ? payload.selected_panel_id : null);
      }
      if (payload.cinematic) setCinematic(payload.cinematic);
      if (typeof payload.selected_shot_id === "string") setCinematicShotId(payload.selected_shot_id);
      if (Array.isArray(payload.jobs)) setJobs(payload.jobs);
      if (Array.isArray(payload.artifacts)) setGenerated(payload.artifacts);
      if (payload.capability) setCapability(payload.capability);
    })();
  }, [universeId, workId]);

  const pendingJob = jobs.find((job) => job.status === "queued" || job.status === "submitted" || job.status === "processing");
  useEffect(() => {
    if (!pendingJob) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/authority/storyboard/jobs/${pendingJob.job_id}`);
      const payload = await response.json().catch(() => ({}));
      if (!payload.job_id) return;
      setJobs((current) => current.map((job) => (job.job_id === payload.job_id ? payload : job)));
      if (payload.status === "completed" && payload.result?.still_url && payload.panel_id) {
        setPanelStills((current) => ({ ...current, [payload.panel_id]: payload.result.still_url }));
      }
      if (payload.status === "completed" || payload.status === "failed" || payload.status === "unavailable" || payload.status === "blocked") {
        setMediaState({
          status: payload.status === "completed" ? "ready" : payload.status,
          message: payload.status === "completed"
            ? "Generation completed. The artifact is not a Scene."
            : operatorGenerationMessage(payload.error?.message ?? "Generation did not complete.").operator,
        });
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [pendingJob?.job_id]);

  function snapshotOf(next: StoryboardWorkRecord, nextScript = script, nextAssembly = assemblyItems): AuthoringSnapshot {
    return workToSnapshot({
      title: next.title,
      body: next.body || nextScript,
      premise: next.premise,
      panels: next.panels.map((panel) => ({
        panel_id: panel.panel_id,
        sequence: panel.sequence,
        title: panel.title,
        description: panel.description,
        narrative_purpose: panel.narrative_purpose,
        action: panel.action,
        dialogue: panel.dialogue,
        narration: panel.narration,
        camera: panel.camera,
        camera_movement: panel.camera_movement,
        framing: panel.framing,
        lens_style: panel.lens_style,
        lighting: panel.lighting,
        environment: panel.environment,
        characters: panel.characters,
        mood: panel.mood,
        transition: panel.transition,
        duration_ms: panel.duration_ms,
        aspect_ratio: panel.aspect_ratio,
        status: panel.status,
        active_still_asset_id: panel.active_still_asset_id,
        active_motion_asset_id: panel.active_motion_asset_id,
        still_url: panel.still_url,
        motion_playback_id: panel.motion_playback_id,
        motion_endpoint: panel.motion_endpoint,
        references: panel.references,
        user_locked: panel.user_locked,
      })),
      assembly: next.assembly?.items ?? nextAssembly,
    });
  }

  function applyWork(next: StoryboardWorkRecord, preferredPanelId?: string | null) {
    setWork(next);
    setWorkTitle(next.title);
    if (next.body) setScript(next.body);
    if (next.assembly?.items) setAssemblyItems(next.assembly.items);
    if (next.cinematic) setCinematic(next.cinematic);
    savedSnapshot.current = snapshotOf(next, next.body, next.assembly?.items ?? []);
    if (typeof window !== "undefined") {
      setHistory(parseHistory(window.localStorage.getItem(historyStorageKey(next.work_id))));
    }
    const preferred = preferredPanelId ?? next.selection?.panel_id ?? null;
    if (preferred) setSelectedId(preferred);
    if (next.selection?.shot_id) setCinematicShotId(next.selection.shot_id);
    if (next.panels.length) {
      setScriptPanels([]);
      setSelectedId((current) => preferred ?? current ?? next.panels[0]?.panel_id ?? null);
      const active = next.panels.find((panel) => panel.panel_id === (preferred ?? selectedId)) ?? next.panels[0];
      if (active) {
        setDraftPanel(active);
        setFirstFrame(active.still_url ?? "");
      }
      const stills: Record<string, string> = {};
      for (const panel of next.panels) {
        if (panel.still_url) stills[panel.panel_id] = panel.still_url;
      }
      setPanelStills((current) => ({ ...stills, ...current }));
    }
    setDirty(false);
    setSaveFailed(false);
  }

  async function mutate(label: string, action: string, payload: Record<string, unknown>, kind: "authoring" | "selection" = "authoring") {
    if (!work) return;
    const before = snapshotOf(work);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, work_id: work.work_id, action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (result.work) {
      const after = snapshotOf(result.work);
      const nextHistory = pushHistory(history, {
        id: `${Date.now()}`,
        label,
        kind,
        reversible: true,
        persistent: true,
        undoHint: `Undo ${label.toLowerCase()}`,
        before,
        after,
      });
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(result.work.work_id), serializeHistory(nextHistory));
      applyWork(result.work, typeof result.selected_panel_id === "string" ? result.selected_panel_id : null);
    }
    return result;
  }

  async function restoreFromSnapshot(snapshot: AuthoringSnapshot, nextHistory: HistoryState) {
    if (!work) return;
    const result = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore-snapshot",
        work_id: work.work_id,
        title: snapshot.title,
        body: snapshot.body,
        premise: snapshot.premise,
        panels: snapshot.panels,
      }),
    });
    const payload = await result.json().catch(() => ({}));
    if (payload.work) {
      applyWork(payload.work);
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(payload.work.work_id), serializeHistory(nextHistory));
    }
  }

  function generatePanelsLocal() {
    const composed = composeStoryboardBody(script);
    setScriptPanels(composed.panels);
    setSelectedId(composed.panels[0]?.panel_id ?? sentinelPanels[0]?.panel_id ?? scenes[0]?.master_id ?? null);
    setSaveState({ status: "idle", message: "" });
  }

  async function saveBody(nextBody = script): Promise<StoryboardWorkRecord | null> {
    setSaveState({ status: "generating", message: "Saving…" });
    setSaveFailed(false);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, action: "save", body: nextBody, work_id: work?.work_id, title: workTitle }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveFailed(true);
      setSaveState({ status: "failed", message: payload.error ?? "Could not save the story body." });
      return null;
    }
    if (payload.work) applyWork(payload.work);
    setDirty(false);
    setSaveState({ status: "ready", message: "Story body saved as a creative artifact. It is not a Scene." });
    return payload.work ?? work;
  }

  async function generateStoryboard() {
    generatePanelsLocal();
    setSaveState({ status: "generating", message: "Generating structured storyboard…" });
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "generate-storyboard",
        body: script,
        work_id: work?.work_id,
        instruction,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.work) applyWork(payload.work);
    if (!response.ok && !payload.work) {
      setSaveState({ status: payload.status === "unavailable" || payload.status === "needs_configuration" ? "unavailable" : "failed", message: payload.error ?? "Storyboard generation failed." });
      return;
    }
    setSaveState({
      status: payload.error ? "unavailable" : "ready",
      message: payload.error
        ? `${payload.error} Local panels were kept. This is not a Scene.`
        : "Structured panels saved. They are not canonical Scenes.",
    });
  }

  async function assist(actionId = "assist") {
    setAssistState({ status: "generating", message: "Asking the configured Google/Chrome AI…" });
    if (actionId === "assist" || actionId === "improve" || actionId === "expand" || actionId === "condense") {
      const chrome = await chromePromptAvailability();
      if (chrome.text) {
        const result = await promptWithChrome({
          system: STORYBOARD_SYSTEM,
          prompt: [
            `Universe: ${universeTitle ?? "Untitled"}`,
            script ? `Current story body:\n${script}` : "No current story body.",
            `Gallery artifacts (visual themes):\n${catalogForChrome(references)}`,
            instruction || "Write a cinematic storyboard story body that can be pictured from the gallery artifacts.",
          ].join("\n\n"),
        });
        if (result.ok) {
          setAssistProposal(result.text);
          setAssistState({ status: "ready", message: "Chrome built-in AI proposed a revision. Apply it to replace authored work." });
          return;
        }
      }
    }
    if (!assistConfigured) {
      const chrome = await chromePromptAvailability();
      if (!chrome.text) {
        setAssistState({
          status: "unavailable",
          message: "Chrome Prompt API is not available here, and Gemini is not configured on the server.",
        });
        return;
      }
    }
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: actionId,
        body: script,
        instruction,
        work_id: work?.work_id,
        panel: selectedPersisted,
        apply: "suggestion",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setAssistState({
        status: payload.status === "unavailable" ? "unavailable" : "failed",
        message: payload.error ?? "AI assist could not complete.",
      });
      return;
    }
    if (payload.applied === false) {
      setAssistProposal(String(payload.suggestion ?? ""));
      setAssistState({
        status: "ready",
        message: "Gemini returned a proposal. Apply it to replace authored work, or discard it.",
      });
      return;
    }
    if (payload.work) applyWork(payload.work);
    else {
      setScript(payload.body ?? "");
      setScriptPanels(payload.panels ?? []);
    }
    setAssistState({ status: "ready", message: "Gemini suggestion applied. It did not create Scenes." });
  }

  async function enqueue(kind: GenerationJobKind, extra: Record<string, unknown> = {}) {
    const saved = work?.work_id ? work : await saveBody();
    const workId = saved?.work_id;
    if (!workId) {
      setMediaState({ status: "failed", message: "Save the story before generating media." });
      return;
    }
    const panelId = selectedId;
    setMediaState({ status: "generating", message: `Queuing ${kind}…` });
    const response = await fetch("/api/authority/storyboard/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        work_id: workId,
        panel_id: panelId,
        kind,
        still_url: extra.still_url ?? selected?.still,
        first_frame_url: firstFrame || selected?.still,
        last_frame_url: lastFrame || undefined,
        reference_urls: [
          ...references.map((reference) => reference.still_url).filter(Boolean),
          ...(work?.frames ?? []).map((frame) => frame.still_url),
          ...(selectedPersisted?.references ?? []).map((ref) => ref.url).filter(Boolean),
        ].filter(Boolean),
        still_urls: generated.map((artifact) => artifact.still_url).filter(Boolean),
        playback_ids: generated.map((artifact) => artifact.playback_id).filter(Boolean),
        extension_video_uri: extra.extension_video_uri ?? selectedJob?.result?.provider_video_uri ?? undefined,
        instruction: extra.instruction ?? draftPanel.generation_metadata?.transformation_instruction ?? selectedPersisted?.generation_metadata?.transformation_instruction ?? instruction,
        ...extra,
        duration_seconds: typeof extra.duration_seconds === "number" ? extra.duration_seconds : durationSeconds,
        aspect_ratio: extra.aspect_ratio === "9:16" || extra.aspect_ratio === "16:9" ? extra.aspect_ratio : aspectRatio,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.job_id) setJobs((current) => [payload, ...current.filter((job) => job.job_id !== payload.job_id)]);
    const jobStatus = typeof payload.status === "string" ? payload.status : "";
    const honestFailure =
      jobStatus === "failed" ||
      jobStatus === "blocked" ||
      jobStatus === "needs_configuration" ||
      jobStatus === "unavailable" ||
      jobStatus === "cancelled";
    if ((!response.ok && response.status !== 202) || honestFailure) {
      setMediaState({
        status: jobStatus === "unavailable" || jobStatus === "needs_configuration" || jobStatus === "blocked" ? jobStatus : "failed",
        message: operatorGenerationMessage(payload.error?.message ?? payload.error ?? payload.message ?? "Generation did not complete.").operator,
      });
      return;
    }
    setMediaState({
      status: payload.status === "completed" ? "ready" : "generating",
      message: payload.status === "completed"
        ? "Artifact ready. It is not a Scene."
        : payload.error?.message ?? `${jobUiLabel(payload.status)} — progress is the real job, not a timer.`,
    });
    if (payload.result?.still_url && panelId) {
      setPanelStills((current) => ({ ...current, [panelId]: payload.result.still_url }));
    }
  }

  async function generateMedia(outputType: StoryboardOutputType) {
    const kind: GenerationJobKind =
      outputType === "gif" ? "gif" :
      outputType === "reel" ? "reel" :
      outputType === "animation" ? "animation" :
      outputType === "clip" ? "motion" :
      "still";
    await enqueue(kind, {
      still_url: selected?.still,
      playback_id: selectedJob?.result?.playback_id,
      animation_style: outputType === "animation" ? "cinematic animation" : undefined,
    });
  }

  async function generateShot(panelId: string) {
    const persisted = persistedPanels.find((panel) => panel.panel_id === panelId);
    const scriptPanel = scriptPanels.find((panel) => panel.panel_id === panelId);
    const sentinelPanel = sentinelPanels.find((panel) => panel.panel_id === panelId);
    const scene = scenes.find((item) => item.master_id === panelId);
    const title = persisted?.title ?? scriptPanel?.title ?? sentinelPanel?.title ?? sceneShortTitle(scene?.title) ?? "Storyboard shot";
    const description = persisted?.description ?? scriptPanel?.description ?? sentinelPanel?.title ?? scene?.description ?? title;
    setPendingPanels((current) => ({ ...current, [panelId]: true }));
    setSelectedId(panelId);
    let still = panelStills[panelId] ?? persisted?.still_url ?? sentinelPanel?.still_url ?? pickGalleryTheme({ title, description }, references)?.still_url ?? null;
    const chrome = await chromePromptAvailability();
    if (!still && chrome.text && references.some((reference) => reference.still_url)) {
      const result = await promptWithChrome({
        system: GALLERY_THEME_SYSTEM,
        prompt: [`Beat: ${title}`, description, `Gallery artifacts:\n${catalogForChrome(references)}`, "Reply with the matching artifact title only."].join("\n\n"),
      });
      if (result.ok) still = parseChromeThemeMatch(result.text, references)?.still_url ?? still;
    }
    if (still) setPanelStills((current) => ({ ...current, [panelId]: still }));
    await enqueue("still", { still_url: still, prompt: description });
    setPendingPanels((current) => ({ ...current, [panelId]: false }));
  }

  async function savePanelEdits() {
    if (!selectedPersisted || !work) return;
    const before = snapshotOf(work);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "save-panel",
        panel_id: selectedPersisted.panel_id,
        patch: draftPanel,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.panel && work) {
      const next: StoryboardWorkRecord = {
        ...work,
        panels: work.panels.map((panel) => (panel.panel_id === payload.panel.panel_id ? payload.panel : panel)),
      };
      const after = snapshotOf(next);
      const nextHistory = pushHistory(history, {
        id: `${Date.now()}`,
        label: "Edit panel",
        kind: "authoring",
        reversible: true,
        persistent: true,
        undoHint: "Undo panel edit",
        before,
        after,
      });
      setHistory(nextHistory);
      window.localStorage.setItem(historyStorageKey(work.work_id), serializeHistory(nextHistory));
      applyWork(next);
      setSaveState({ status: "ready", message: "Panel edits saved. AI will not overwrite this panel silently." });
    }
  }

  async function importSentinel() {
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "import-sentinel",
        panels: sentinelPanels.map((panel) => ({
          title: panel.title,
          description: panel.kind === "scene" ? "Canonical Scene evidence. Not a new Scene." : panel.title,
          still_url: panel.still_url,
          time_ms: panel.time_ms,
          sentinel_panel_id: panel.panel_id,
          scene_master_id: panel.scene_master_id,
        })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.work) applyWork(payload.work);
    if (payload.work?.panels?.[0]) setTab("panels");
  }

  const cinematicShots = cinematic?.shots ?? [];
  const bulkShots = cinematicShots.filter((shot) => bulkShotIds.includes(shot.shot_id));
  const selectedObservation = selectedPersisted?.generation_metadata?.sentinel_observation ?? null;
  const selectedFrame = (work?.frames ?? []).find((frame) => frame.panel_id === selectedId) ?? work?.frames?.[0] ?? null;
  const transformationInstruction = selectedPersisted?.generation_metadata?.transformation_instruction
    ?? (draftPanel.generation_metadata?.transformation_instruction ?? null);

  async function analyseSentinel() {
    if (!work) {
      setSentinelError("Save or create the storyboard before analysing source media.");
      return;
    }
    setAnalysing(true);
    setSentinelError(null);
    const result = await mutate("Analyse Sentinel", "analyse-sentinel", {});
    setAnalysing(false);
    if (result?.cinematic) {
      setCinematic(result.cinematic as CinematicAnalysis);
      setSentinelMessage(
        result.provider === "gemini"
          ? "Gemini described sampled Mux frames across the attached source. Sentinel remains observational."
          : "Sampled-frame fallback. Full video-file understanding was not used.",
      );
    } else if (result?.error) {
      setSentinelError(String(result.error));
    }
  }

  async function selectCinematicShot(shot: CinematicShot) {
    setCinematicShotId(shot.shot_id);
    const result = await mutate("Select Sentinel shot", "select-sentinel-shot", { shot }, "selection");
    if (typeof result?.selected_panel_id === "string") setSelectedId(result.selected_panel_id);
    if (typeof result?.selected_shot_id === "string") setCinematicShotId(result.selected_shot_id);
    if (result?.work) {
      const panel = (result.work as StoryboardWorkRecord).panels.find((item) => item.panel_id === result.selected_panel_id);
      if (panel) {
        setDraftPanel(panel);
        setFirstFrame(panel.still_url ?? "");
      }
    }
    setSentinelMessage(`Selected Shot ${String(shot.sequence).padStart(2, "0")}. Storyboard panel and inspector now use this observation.`);
  }

  async function addCinematicReferences(shots: CinematicShot[], panelId?: string | null) {
    const playbackId = work?.sources?.[0]?.playback_id;
    if (!playbackId) {
      setSentinelError("Attach source media before creating references.");
      return;
    }
    const result = await mutate("Add Sentinel references", "add-sentinel-references", {
      shots,
      playback_id: playbackId,
      panel_id: panelId ?? selectedPersisted?.panel_id ?? null,
    }, "selection");
    if (result) {
      setSentinelMessage(`Added ${result.added ?? 0} to References${result.skipped ? ` · skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}.`);
      if ((result.added ?? 0) > 0) setTab("references");
    }
  }

  async function addCinematicShots(shots: CinematicShot[]) {
    const result = await mutate("Add Sentinel shots", "add-sentinel-shots", { shots }, "selection");
    if (Array.isArray(result?.panel_ids)) {
      setSentinelMessage(`Added ${result.panel_ids.length} observation${result.panel_ids.length === 1 ? "" : "s"} to the storyboard.`);
      const last = result.panel_ids[result.panel_ids.length - 1];
      if (typeof last === "string") setSelectedId(last);
    }
  }

  async function attachReferenceStill(reference: { asset_id: string; title: string; still_url: string | null; time_ms: number }) {
    if (!reference.still_url) {
      setMediaState({ status: "failed", message: "That reference has no still yet." });
      return;
    }
    let current = work;
    if (!current) {
      const created = await fetch("/api/authority/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universe_id: universeId, action: "create-work", title: workTitle }),
      });
      const payload = await created.json().catch(() => ({}));
      if (!payload.work) {
        setMediaState({ status: "failed", message: "Create the storyboard work before attaching a still." });
        return;
      }
      applyWork(payload.work);
      current = payload.work as StoryboardWorkRecord;
    }
    const persistedId = current.panels.some((panel) => panel.panel_id === selectedId) ? selectedId : null;
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "use-still",
        work_id: current.work_id,
        panel_id: persistedId,
        asset_id: reference.asset_id,
        still_url: reference.still_url,
        title: reference.title,
        time_ms: reference.time_ms,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.work) {
      applyWork(payload.work);
      const attached = persistedId
        ? payload.work.panels.find((panel: StoryboardWorkRecord["panels"][number]) => panel.panel_id === persistedId)
        : payload.work.panels[payload.work.panels.length - 1];
      if (attached?.panel_id) setSelectedId(attached.panel_id);
      setMediaState({ status: "ready", message: "Still attached to a storyboard panel. Sentinel evidence is not a Scene." });
      setTab("panels");
    }
  }


  const creativeCount = persistedPanels.length || scriptPanels.length;
  const sequenceEmpty = creativeCount === 0 && sentinelPanels.length === 0 && scenes.length === 0;
  const progress = deriveStoryboardProgress({
    script,
    panelCount: creativeCount || (script ? 0 : scenes.length),
    referenceStillCount:
      references.filter((reference) => Boolean(reference.still_url)).length
      + persistedPanels.reduce((sum, panel) => sum + panel.references.length, 0)
      + (work?.frames?.length ?? 0),
    artifactStillCount: generated.filter((artifact) => Boolean(artifact.still_url)).length + persistedPanels.filter((panel) => panel.still_url).length,
    artifactTypes: [
      ...generated.map((artifact) => artifact.output_type),
      ...jobs.filter((job) => job.status === "completed").map((job) => job.kind),
      ...persistedPanels.flatMap((panel) => [panel.still_url ? "still" : "", panel.motion_playback_id ? "motion" : ""]),
    ].filter(Boolean),
    assemblyItemCount: assemblyItems.length,
  });
  const shotIds = [
    ...persistedPanels.map((panel) => panel.panel_id),
    ...scriptPanels.map((panel) => panel.panel_id),
    ...sentinelPanels.map((panel) => panel.panel_id),
    ...(persistedPanels.length === 0 && scriptPanels.length === 0 && sentinelPanels.length === 0 ? scenes.map((scene) => scene.master_id) : []),
  ];

  useEffect(() => {
    if (!playing || shotIds.length === 0) return;
    const timer = window.setInterval(() => {
      setSelectedId((current) => {
        const index = Math.max(0, shotIds.indexOf(current ?? shotIds[0]));
        return shotIds[(index + 1) % shotIds.length];
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [playing, shotIds.join("|")]);

  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    if (!dirty || !work?.work_id) return;
    autosaveTimer.current = window.setTimeout(() => {
      void saveBody();
    }, 1600);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [script, workTitle, dirty, work?.work_id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveBody();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const next = redoHistory(history);
          if (next) void restoreFromSnapshot(next.entry.after, next.state);
        } else {
          const next = undoHistory(history);
          if (next) void restoreFromSnapshot(next.entry.before, next.state);
        }
      }
      if (event.key === "Escape") {
        setResetOpen(false);
        setInspectorOpen(false);
      }
      if (!typing && (event.key === "Delete" || event.key === "Backspace") && selectedPersisted) {
        event.preventDefault();
        void mutate("Delete panel", "delete-panel", { panel_id: selectedPersisted.panel_id });
      }
      if (!typing && (event.key === "ArrowRight" || event.key === "ArrowLeft") && shotIds.length) {
        const index = Math.max(0, shotIds.indexOf(selectedId ?? shotIds[0]));
        const next = event.key === "ArrowRight" ? Math.min(shotIds.length - 1, index + 1) : Math.max(0, index - 1);
        setSelectedId(shotIds[next]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const editorPanel = draftPanel.panel_id === selectedPersisted?.panel_id ? draftPanel : selectedPersisted ?? draftPanel;
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
  const interactionPhase = studioPhaseForTab(tab);
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
  const activeReferenceUrls = [
    ...references.map((item) => item.still_url).filter(Boolean),
    ...(work?.frames ?? []).map((frame) => frame.still_url),
    ...persistedPanels.flatMap((panel) => panel.references.map((ref) => ref.url).filter(Boolean)),
  ] as string[];

  async function confirmDeleteWorkspace() {
    if (!work?.work_id) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-work", work_id: work.work_id }),
    });
    const payload = await response.json().catch(() => ({}));
    setDeleteBusy(false);
    if (!response.ok || payload.deleted !== true) {
      setDeleteError(payload.error ?? "Storyboard could not be deleted.");
      return;
    }
    setDeleteOpen(false);
    router.push(backHref);
    router.refresh();
  }

  async function retryJob(jobId: string) {
    const response = await fetch(`/api/authority/storyboard/jobs/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.job_id) setJobs((current) => [payload, ...current.filter((job) => job.job_id !== payload.job_id)]);
  }

  async function cancelJob(jobId: string) {
    await fetch(`/api/authority/storyboard/jobs/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  }

  return (
    <div className="storyboard-workspace multiverse-page" data-storyboard-layout="workstation">
      {/* ── Top bar ── */}
      <div className="storyboard-header px-4 py-2 border-b border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          {universeId ? null : (
            <HierarchyBreadcrumb
              items={[
                { label: "Studio", href: "/studio" },
                { label: "Storyboard", href: backHref },
                { label: workTitle || "Untitled storyboard" },
              ]}
            />
          )}
          {universeId ? null : (
            <Link href={backHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Back
            </Link>
          )}
          <Input
            aria-label="Work title"
            className="h-8 max-w-xs"
            value={workTitle}
            onChange={(event) => { setWorkTitle(event.target.value); setDirty(true); }}
          />
          <p className="text-xs text-muted-foreground" data-save-state={saveLabel}>{saveLabel}</p>
          <p className="text-[11px] text-muted-foreground">
            {work?.universe_id ? "Attached · non-canonical" : "Unattached · non-canonical"}
          </p>
        </div>
        <div className="storyboard-header-actions">
          <Button type="button" size="sm" variant="outline" disabled={!undoEntry} title={undoEntry?.undoHint ?? "Undo"} onClick={() => { const next = undoHistory(history); if (next) void restoreFromSnapshot(next.entry.before, next.state); }}>Undo</Button>
          <Button type="button" size="sm" variant="outline" disabled={!redoEntry} title={redoEntry ? `Redo ${redoEntry.label}` : "Redo"} onClick={() => { const next = redoHistory(history); if (next) void restoreFromSnapshot(next.entry.after, next.state); }}>Redo</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setResetOpen(true)}>Reset</Button>
          {work?.work_id ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>Delete</Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => void saveBody()}>Save</Button>
        </div>
      </div>
      <StoryboardResetDialog
        open={resetOpen}
        panelSelected={Boolean(selectedPersisted)}
        onClose={() => setResetOpen(false)}
        onConfirm={(scope: ResetScope) => {
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
      />
      <StoryboardDeleteDialog
        open={deleteOpen}
        title={workTitle}
        attached={Boolean(work?.universe_id)}
        busy={deleteBusy}
        error={deleteError}
        onClose={() => { if (!deleteBusy) setDeleteOpen(false); }}
        onConfirm={() => void confirmDeleteWorkspace()}
      />

      {/* ── Unified creative workspace ── */}
      <div className="studio-unified-workspace" style={{ height: 'calc(100vh - 3.5rem - 2.75rem - 2.5rem)' }}>
        {/* LEFT — Context sidebar: panels + scenes */}
        <StudioContextSidebar
          universeTitle={universeTitle}
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
        />

        {/* MAIN — Creation surface */}
        <StudioCreationSurface
          surfaceView={surfaceView}
          onSurfaceView={setSurfaceView}
          work={work}
          intelligence={intelligence}
          previewHref={previewHref}
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
          firstFrame={firstFrame}
          lastFrame={lastFrame}
          durationSeconds={durationSeconds}
          aspectRatio={aspectRatio}
          activeReferenceUrls={activeReferenceUrls}
          references={references}
          workFrames={work?.frames ?? []}
          capability={capability}
          onDraftChange={(patch) => setDraftPanel(patch)}
          onSavePanel={() => void savePanelEdits()}
          onGenerateStill={() => void generateMedia("still")}
          onEnqueue={(kind, extra) => void enqueue(kind, extra)}
          onSetFirstFrame={setFirstFrame}
          onSetLastFrame={setLastFrame}
          onSetDuration={setDurationSeconds}
          onSetAspect={setAspectRatio}
          onRetryJob={(jobId) => void retryJob(jobId)}
          onCancelJob={(jobId) => void cancelJob(jobId)}
          onWorkUpdate={(w) => applyWork(w)}
        />
      </div>

      {/* ASSEMBLY — footer status bar */}
      <div className="flex-shrink-0">
        <StoryboardAssemblyBar
          assemblyItems={assemblyItems}
          panelCount={persistedPanels.length}
          universeId={universeId}
          canAddSelected={Boolean(selected)}
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
    </div>
  );
}

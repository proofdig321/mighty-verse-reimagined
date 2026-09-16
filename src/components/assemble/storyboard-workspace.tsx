"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Images, Pause, Play, Shield, SkipBack, SkipForward, Sparkles, Clapperboard, Film, LayoutGrid, Layers } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatTimelineMs, secondsFromMs } from "@/lib/media/timing";
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
import { SentinelIntelligencePanel } from "./sentinel-intelligence";
import { AssociateStoryboard } from "./associate-storyboard";
import { StoryboardHlsPreview } from "./storyboard-hls-preview";
import { StoryboardResetDialog } from "./storyboard-reset-dialog";
import { StoryboardSourceMedia } from "./storyboard-source-media";
import { creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { deriveStoryboardProgress, storyboardOperatorChainLabel } from "@/lib/assemble/storyboard-progress";
import { cn } from "@/lib/utils";
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
import { derivePanelUiStatus, motionRequirement, panelUiLabel } from "@/lib/storyboard/panel-state";
import type { ResetScope } from "@/lib/storyboard/mutations";
import { HierarchyBreadcrumb } from "./breadcrumb";

type MaterialTab = "script" | "assist" | "sentinel" | "references" | "panels" | "stills" | "motion" | "assembly";
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
  const [capability, setCapability] = useState<CapabilityCard | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [workTitle, setWorkTitle] = useState(universeTitle ?? "Untitled storyboard");
  const [history, setHistory] = useState<HistoryState>(emptyHistory);
  const [dirty, setDirty] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [assistProposal, setAssistProposal] = useState<string | null>(null);
  const [assemblyItems, setAssemblyItems] = useState<AuthoringSnapshot["assembly"]>([]);
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
        applyWork(payload.work);
      }
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
            : payload.error?.message ?? "Generation did not complete.",
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

  function applyWork(next: StoryboardWorkRecord) {
    setWork(next);
    setWorkTitle(next.title);
    if (next.body) setScript(next.body);
    if (next.assembly?.items) setAssemblyItems(next.assembly.items);
    savedSnapshot.current = snapshotOf(next, next.body, next.assembly?.items ?? []);
    if (typeof window !== "undefined") {
      setHistory(parseHistory(window.localStorage.getItem(historyStorageKey(next.work_id))));
    }
    if (next.panels.length) {
      setScriptPanels([]);
      setSelectedId((current) => current ?? next.panels[0]?.panel_id ?? null);
      if (next.panels[0]) {
        setDraftPanel(next.panels[0]);
        setFirstFrame(next.panels[0].still_url ?? "");
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
      applyWork(result.work);
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
        reference_urls: references.map((reference) => reference.still_url).filter(Boolean),
        still_urls: generated.map((artifact) => artifact.still_url).filter(Boolean),
        playback_ids: generated.map((artifact) => artifact.playback_id).filter(Boolean),
        extension_video_uri: extra.extension_video_uri ?? selectedJob?.result?.provider_video_uri ?? undefined,
        instruction,
        ...extra,
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
        message: payload.error?.message ?? payload.error ?? payload.message ?? "Generation did not complete.",
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
    if (!selectedPersisted) return;
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
      applyWork({
        ...work,
        panels: work.panels.map((panel) => (panel.panel_id === payload.panel.panel_id ? payload.panel : panel)),
      });
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

  async function useStill(reference: { asset_id: string; title: string; still_url: string | null; time_ms: number }) {
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

  const tabs: { id: MaterialTab; label: string; icon: typeof FileText }[] = [
    { id: "script", label: "Script", icon: FileText },
    { id: "assist", label: "AI Assist", icon: Sparkles },
    { id: "sentinel", label: "Sentinel", icon: Shield },
    { id: "references", label: "References", icon: Images },
    { id: "panels", label: "Panels", icon: LayoutGrid },
    { id: "stills", label: "Stills", icon: Clapperboard },
    { id: "motion", label: "Motion", icon: Film },
    { id: "assembly", label: "Assembly", icon: Layers },
  ];
  const creativeCount = persistedPanels.length || scriptPanels.length;
  const sequenceEmpty = creativeCount === 0 && sentinelPanels.length === 0 && scenes.length === 0;
  const progress = deriveStoryboardProgress({
    script,
    panelCount: creativeCount || (script ? 0 : scenes.length),
    referenceStillCount: references.filter((reference) => Boolean(reference.still_url)).length + persistedPanels.reduce((sum, panel) => sum + panel.references.length, 0),
    artifactStillCount: generated.filter((artifact) => Boolean(artifact.still_url)).length + persistedPanels.filter((panel) => panel.still_url).length,
    artifactTypes: [
      ...generated.map((artifact) => artifact.output_type),
      ...jobs.filter((job) => job.status === "completed").map((job) => job.kind),
      ...persistedPanels.flatMap((panel) => [panel.still_url ? "still" : "", panel.motion_playback_id ? "motion" : ""]),
    ].filter(Boolean),
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

  return (
    <div className="storyboard-workspace" data-storyboard-layout="workspace">
      <div className="storyboard-header">
        <div className="min-w-0 space-y-2">
          <HierarchyBreadcrumb
            items={[
              { label: "Creative Studio", href: "/studio" },
              { label: "Storyboard", href: backHref },
              { label: workTitle || "Untitled storyboard" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {backHref ? (
              <Link href={backHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                Back
              </Link>
            ) : null}
            <Input
              aria-label="Work title"
              className="h-8 max-w-sm"
              value={workTitle}
              onChange={(event) => {
                setWorkTitle(event.target.value);
                setDirty(true);
              }}
            />
            <p className="text-xs text-muted-foreground" data-save-state={saveLabel}>
              {saveLabel}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {work?.universe_id ? "Attached · non-canonical" : "Unattached · non-canonical"}
            </p>
          </div>
        </div>
        <div className="storyboard-header-actions">
          <Button type="button" size="sm" variant="outline" disabled={!undoEntry} title={undoEntry?.undoHint ?? "Undo"} onClick={() => {
            const next = undoHistory(history);
            if (next) void restoreFromSnapshot(next.entry.before, next.state);
          }}>
            Undo
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!redoEntry} title={redoEntry ? `Redo ${redoEntry.label}` : "Redo"} onClick={() => {
            const next = redoHistory(history);
            if (next) void restoreFromSnapshot(next.entry.after, next.state);
          }}>
            Redo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setResetOpen(true)}>Reset</Button>
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
          if (scope === "saved" && savedSnapshot.current) {
            setScript(savedSnapshot.current.body);
            setWorkTitle(savedSnapshot.current.title);
            setDirty(false);
            if (work) applyWork(work);
            return;
          }
          if (scope === "panel" && selectedPersisted && work) {
            setDraftPanel(selectedPersisted);
            return;
          }
          void mutate("Reset", "reset", { scope: scope === "panel-artifacts" ? "panel-artifacts" : "initial", panel_id: selectedPersisted?.panel_id });
        }}
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {universeId ? (
          <p className="text-sm text-muted-foreground">
            Target Association · {universeTitle ?? "Canonical Universe"}
          </p>
        ) : (
          <>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Standalone workspace
              </p>
              <p className="text-sm text-muted-foreground">
                Idea → story → panels → stills → motion. Association with a Universe is optional and explicit.
              </p>
            </div>
            <Card className="w-full bg-card/60 lg:max-w-md" size="sm">
              <CardContent>
                <AssociateStoryboard universes={universes} workId={work?.work_id} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {capability ? (
        <p className="text-xs text-muted-foreground" data-ai-capability={capability.configured ? "gemini" : "none"}>
          {capability.configured
            ? `Gemini is configured · text ${capability.models?.text ?? "ready"} · image ${capability.models?.image ?? "ready"} · video ${capability.models?.video ?? "ready"}. Unavailable generations report the provider error, not a missing product.`
            : `${capability.label} Generation actions stay available and report the real configuration or quota state.`}
        </p>
      ) : null}

      <div className="storyboard-progress" data-storyboard-progress={`${progress.completeCount}/${progress.total}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {storyboardOperatorChainLabel()}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Storyboard path · {progress.completeCount} of {progress.total} live
        </p>
        <ol className="storyboard-progress-track">
          {progress.steps.map((step) => (
            <li key={step.id} className="storyboard-progress-step" data-complete={step.complete ? "true" : "false"}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setTab(step.id as MaterialTab)}
              >
                <div className="storyboard-progress-bar" aria-hidden="true">
                  <span />
                </div>
                <p>{step.label}</p>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="storyboard-stage">
        <Card className="flex min-h-0 flex-col bg-card/70">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="uppercase tracking-[0.16em]">
              {tab === "assist" ? "AI Assist" : tab === "sentinel" ? "Sentinel" : tabs.find((item) => item.id === tab)?.label ?? "Script & Narrative"}
            </CardTitle>
            <CardDescription>
              {tab === "script" || tab === "assist" || tab === "sentinel"
                ? "Write or paste a story. AI proposes. You authorise. Panels are not Scenes."
                : "Workspace section. Artifacts stay non-canonical until a curator promotes them."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-4">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (
                  value === "script" ||
                  value === "assist" ||
                  value === "sentinel" ||
                  value === "references" ||
                  value === "panels" ||
                  value === "stills" ||
                  value === "motion" ||
                  value === "assembly"
                ) {
                  setTab(value);
                }
              }}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              {tab === "script" || tab === "assist" || tab === "sentinel" ? (
                <TabsList
                  className="flex h-auto w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto"
                  aria-label="Script authoring"
                >
                  {tabs
                    .filter((item) => item.id === "script" || item.id === "assist" || item.id === "sentinel")
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <TabsTrigger key={item.id} value={item.id} className="h-8 flex-none gap-1.5">
                          <Icon size={13} />
                          {item.label}
                        </TabsTrigger>
                      );
                    })}
                </TabsList>
              ) : null}

              <TabsContent value="script" className="storyboard-tab-panel space-y-4">
                <section data-column="script" aria-labelledby="storyboard-script-heading" className="space-y-3">
                  <h3 id="storyboard-script-heading" className="sr-only">
                    Script
                  </h3>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Story body</span>
                    <Textarea
                      value={script}
                      onChange={(event) => {
                        setScript(event.target.value);
                        setDirty(true);
                      }}
                      className="min-h-[28rem] flex-1 font-mono text-sm leading-relaxed"
                      placeholder="SCENE 1: EXT. CITY STREET — NIGHT&#10;The detective walks the mural. Camera: close-up."
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void generateStoryboard()}>
                      Generate storyboard
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void saveBody()}>
                      Save story body
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void assist("expand")}>
                      Expand story
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void assist("condense")}>
                      Condense story
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void assist("improve")}>
                      Refine story
                    </Button>
                  </div>
                  <StatusLine state={saveState} />
                  <p className="text-xs text-muted-foreground">
                    Script is a creative input. Generating panels does not create Scenes or change canonical timing.
                  </p>
                </section>
              </TabsContent>

              <TabsContent value="assist" className="storyboard-tab-panel space-y-4">
                <p className="text-xs text-muted-foreground">
                  {selectedPersisted ? `Context: panel “${selectedPersisted.title}”.` : work ? "Context: this storyboard." : "Context: new story."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ASSIST_ACTIONS.map((item) => (
                    <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => void assist(item.id)}>
                      {item.label}
                    </Button>
                  ))}
                </div>
                <label className="block space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Additional instruction</span>
                  <Textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    className="min-h-28 text-sm"
                    placeholder="Tighten the opening. Keep existing canonical Scenes as destination, not generated objects."
                  />
                </label>
                <Button type="button" size="sm" onClick={() => void assist()}>
                  Generate / refine story
                </Button>
                <StatusLine state={assistState} />
                {assistProposal ? (
                  <div className="storyboard-assist-diff">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{script || "No authored story yet."}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Proposed</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{assistProposal}</p>
                    </div>
                    <div className="col-span-full flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => {
                        setScript(assistProposal);
                        setDirty(true);
                        setAssistProposal(null);
                      }}>Apply</Button>
                      <Button type="button" size="sm" onClick={async () => {
                        setScript(assistProposal);
                        setAssistProposal(null);
                        await saveBody(assistProposal);
                      }}>Apply & Save</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setAssistProposal(null)}>Discard</Button>
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Chrome Prompt API is the intended local path. Gemini is the server path. AI output remains a proposal until you save it.
                </p>
              </TabsContent>

              <TabsContent value="sentinel" className="storyboard-tab-panel">
                <section data-column="sentinel" aria-labelledby="universe-sentinel" className="space-y-3">
                  {intelligence && universeId ? (
                    <div className="suite-section">
                      <div className="suite-section-head">
                        <h2 id="universe-sentinel" className="suite-section-title">
                          Sentinel
                        </h2>
                        <p className="suite-section-note">
                          Sentinel is observational evidence: overview, timed segments, subjects, frame context, and uncertainty.
                          It does not author transformations or create Scenes. Import copies observed stills onto storyboard panels.
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => void importSentinel()}>
                        Import evidence as storyboard panels
                      </Button>
                      {establishHref ? (
                        <Link href={establishHref} className={cn(buttonVariants({ size: "sm" }))}>
                          Mark scenes on Curate Sentinel
                        </Link>
                      ) : null}
                      <SentinelIntelligencePanel
                        universeId={universeId}
                        intelligence={intelligence}
                        canAuthorise={canAuthoriseSentinel}
                        canRetainReference={canAuthoriseSentinel}
                        inspectHref={inspectHref}
                        previewHref={previewHref}
                        establishHref={establishHref}
                      />
                    </div>
                  ) : (
                    <>
                      <h2 id="universe-sentinel" className="suite-section-title">
                        Sentinel
                      </h2>
                      <p className="suite-empty">No Sentinel evidence is available yet. Inspect the bound source to observe it.</p>
                    </>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="references" className="storyboard-tab-panel space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">References</p>
                <StoryboardSourceMedia
                  workId={work?.work_id ?? workId}
                  sources={work?.sources ?? []}
                  frames={work?.frames ?? []}
                  selectedPanelId={selectedId}
                  onWork={(next) => {
                    if (next && typeof next === "object" && "work_id" in (next as object)) applyWork(next as StoryboardWorkRecord);
                  }}
                />
                {references.length === 0 && generated.length === 0 ? (
                  <p className="suite-empty">No curated workspace reference assets indexed yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {generated.map((artifact, index) => (
                      <li key={`${artifact.title}-${index}`} className="w-36">
                        {artifact.still_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artifact.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                        ) : (
                          <div className="aspect-video rounded bg-muted/40" />
                        )}
                        <p className="mt-1 text-xs text-foreground">{artifact.title}</p>
                        <p className="text-[10px] text-muted-foreground">{artifact.output_type} · {artifact.status}</p>
                      </li>
                    ))}
                    {references.map((reference) => (
                      <li key={reference.asset_id} className="w-36">
                        {reference.still_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={reference.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                        ) : (
                          <div className="aspect-video rounded bg-muted/40" />
                        )}
                        <p className="mt-1 text-xs text-foreground">{reference.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {reference.role} · {secondsFromMs(reference.time_ms)}s
                        </p>
                        {reference.still_url ? (
                          <div className="mt-1 grid gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-full text-[10px]"
                              onClick={() => void useStill(reference)}
                            >
                              Use on storyboard
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-full text-[10px]" onClick={() => setLastFrame(reference.still_url as string)}>
                              Use as last frame
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="panels" className="storyboard-tab-panel space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void mutate("Create panel", "create-panel", {})}>Create panel</Button>
                  <Button type="button" size="sm" variant="outline" disabled={!selectedPersisted} onClick={() => selectedPersisted && void mutate("Duplicate panel", "duplicate-panel", { panel_id: selectedPersisted.panel_id })}>Duplicate</Button>
                  <Button type="button" size="sm" variant="outline" disabled={!selectedPersisted} onClick={() => selectedPersisted && void mutate("Delete panel", "delete-panel", { panel_id: selectedPersisted.panel_id })}>Delete</Button>
                  <Button type="button" size="sm" variant="outline" disabled={!selectedPersisted} onClick={() => {
                    if (!selectedPersisted) return;
                    const ids = persistedPanels.map((panel) => panel.panel_id);
                    const index = ids.indexOf(selectedPersisted.panel_id);
                    if (index <= 0) return;
                    const next = [...ids];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    void mutate("Reorder panels", "reorder-panels", { panel_ids: next });
                  }}>Move earlier</Button>
                  <Button type="button" size="sm" variant="outline" disabled={!selectedPersisted} onClick={() => {
                    if (!selectedPersisted) return;
                    const ids = persistedPanels.map((panel) => panel.panel_id);
                    const index = ids.indexOf(selectedPersisted.panel_id);
                    if (index < 0 || index >= ids.length - 1) return;
                    const next = [...ids];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    void mutate("Reorder panels", "reorder-panels", { panel_ids: next });
                  }}>Move later</Button>
                </div>
                <p className="text-xs text-muted-foreground">Panels are creative objects, not Scenes. Reorder is undoable.</p>
              </TabsContent>
              <TabsContent value="stills" className="storyboard-tab-panel space-y-3">
                <p className="text-xs text-muted-foreground">Generate a still for the selected panel. Previous successful stills stay in history.</p>
                <Button type="button" size="sm" onClick={() => void generateMedia("still")}>Generate still</Button>
                <StatusLine state={mediaState} />
                {selectedPersisted?.generation_metadata?.stills?.length ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedPersisted.generation_metadata.stills.map((entry, index) => (
                      <li key={entry.asset_id}>
                        {entry.still_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.still_url} alt="" className="aspect-video w-full rounded object-cover" />
                        ) : <div className="aspect-video rounded bg-muted/40" />}
                        <p className="mt-1 text-[11px] text-muted-foreground">Generation {index + 1} · {entry.status}</p>
                        <Button type="button" size="sm" variant="outline" className="mt-1 h-7 text-[10px]" onClick={() => void mutate("Select still", "save-panel", { panel_id: selectedPersisted.panel_id, patch: { active_still_asset_id: entry.asset_id } }, "selection")}>Select</Button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="suite-empty">No still history on this panel yet.</p>}
              </TabsContent>
              <TabsContent value="motion" className="storyboard-tab-panel space-y-3">
                <p className="text-xs text-muted-foreground">Motion uses the configured Veo model. Unsupported modes stay explained, not mysterious.</p>
                {([
                  ["motion", "Text to video"],
                  ["animate-still", "Image to video"],
                  ["first-last-frame", "First / last frame"],
                  ["reference-motion", "Reference images"],
                  ["extend", "Video extension"],
                ] as const).map(([kind, label]) => {
                  const requirement = motionRequirement({
                    kind,
                    stillUrl: selected?.still,
                    lastFrameUrl: lastFrame || null,
                    referenceUrls: [...references.map((item) => item.still_url).filter(Boolean), ...persistedPanels.flatMap((panel) => panel.references.map((ref) => ref.url).filter(Boolean))] as string[],
                    extensionVideoUri: selectedJob?.result?.provider_video_uri ?? null,
                  });
                  return (
                    <div key={kind} className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={!requirement.available} title={requirement.reason ?? label} onClick={() => void enqueue(kind)}>
                        {label}
                      </Button>
                      {!requirement.available ? <p className="text-xs text-muted-foreground">{requirement.reason}</p> : null}
                    </div>
                  );
                })}
                <StatusLine state={mediaState} />
              </TabsContent>
              <TabsContent value="assembly" className="storyboard-tab-panel space-y-3">
                <p className="text-xs text-muted-foreground">Storyboard assembly is not the public Experience. Select generated artifacts, order them, and save.</p>
                <Button type="button" size="sm" onClick={() => {
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
                }}>Add selected to assembly</Button>
                <ol className="space-y-2">
                  {assemblyItems.map((item, index) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <span>{index + 1}. {item.label}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => {
                        const next = assemblyItems.filter((entry) => entry.id !== item.id);
                        setAssemblyItems(next);
                        void mutate("Remove assembly item", "save-assembly", { items: next });
                      }}>Remove</Button>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col bg-card/70">
          <CardHeader className="border-b border-border/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Storyboard panels</p>
            <CardTitle>
              <h2 id="storyboard-sequence" className="text-base font-medium leading-snug">
                Storyboard
              </h2>
            </CardTitle>
            <CardDescription>
              Visual sequence. GENERATE stills, animate, or assemble. Artifacts stay non-canonical until a curator promotes them.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-4" data-column="sequence" aria-labelledby="storyboard-sequence">
            {sequenceEmpty ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
                <div className="mb-3 size-12 rounded-full border border-border bg-background" aria-hidden="true" />
                <h3 className="text-sm font-medium text-foreground">Visual sequence container empty</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Write a script or inspect source media to begin organizing storyboard compositions.
                </p>
              </div>
            ) : (
              <ol className="storyboard-panel-strip">
                {persistedPanels.map((panel) => (
                  <li key={panel.panel_id}>
                    <ShotFrame
                      shotLabel={`Shot ${panel.sequence}`}
                      subtitle={panel.camera || panel.title}
                      still={panelStills[panel.panel_id] ?? panel.still_url}
                      pending={Boolean(pendingPanels[panel.panel_id])}
                      selected={selectedId === panel.panel_id}
                      status={derivePanelUiStatus({
                        selected: selectedId === panel.panel_id,
                        persistedStatus: panel.status,
                        stillUrl: panelStills[panel.panel_id] ?? panel.still_url,
                        motionPlaybackId: panel.motion_playback_id,
                        jobs: jobs.filter((job) => job.panel_id === panel.panel_id),
                      })}
                      onSelect={() => {
                        setSelectedId(panel.panel_id);
                        setDraftPanel(panel);
                        setFirstFrame(panel.still_url ?? "");
                      }}
                      onGenerate={() => void generateShot(panel.panel_id)}
                    />
                  </li>
                ))}
                {scriptPanels.map((panel, index) => (
                  <li key={panel.panel_id}>
                    <ShotFrame
                      shotLabel={`Shot ${index + 1}`}
                      subtitle={panel.camera || panel.title}
                      still={panelStills[panel.panel_id] ?? null}
                      pending={Boolean(pendingPanels[panel.panel_id])}
                      selected={selectedId === panel.panel_id}
                      onSelect={() => setSelectedId(panel.panel_id)}
                      onGenerate={() => void generateShot(panel.panel_id)}
                    />
                  </li>
                ))}
                {sentinelPanels.map((panel) => (
                  <li key={panel.panel_id}>
                    <StoryboardEvidencePanel
                      panel={panel}
                      selected={selectedId === panel.panel_id}
                      still={panelStills[panel.panel_id] ?? panel.still_url}
                      pending={Boolean(pendingPanels[panel.panel_id])}
                      onSelect={() => setSelectedId(panel.panel_id)}
                      onGenerate={() => void generateShot(panel.panel_id)}
                    />
                  </li>
                ))}
                {persistedPanels.length === 0 && scriptPanels.length === 0 && sentinelPanels.length === 0
                  ? scenes.map((scene, index) => (
                      <li key={scene.master_id}>
                        <ShotFrame
                          shotLabel={`Shot ${index + 1}`}
                          subtitle={sceneShortTitle(scene.title) ?? scene.title ?? "Untitled"}
                          still={panelStills[scene.master_id] ?? null}
                          pending={Boolean(pendingPanels[scene.master_id])}
                          selected={selectedId === scene.master_id}
                          onSelect={() => setSelectedId(scene.master_id)}
                          onGenerate={() => void generateShot(scene.master_id)}
                          badge="Scene"
                        />
                      </li>
                    ))
                  : null}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {shotIds.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            const index = Math.max(0, shotIds.indexOf(selectedId ?? shotIds[0]));
            setSelectedId(shotIds[Math.max(0, index - 1)]);
          }}>
            <SkipBack size={14} />
          </Button>
          <Button type="button" size="sm" onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            const index = Math.max(0, shotIds.indexOf(selectedId ?? shotIds[0]));
            setSelectedId(shotIds[Math.min(shotIds.length - 1, index + 1)]);
          }}>
            <SkipForward size={14} />
          </Button>
          <input
            type="range"
            min={0}
            max={Math.max(0, shotIds.length - 1)}
            value={Math.max(0, shotIds.indexOf(selectedId ?? shotIds[0]))}
            onChange={(event) => setSelectedId(shotIds[Number(event.target.value)] ?? shotIds[0])}
            className="h-1 flex-1 accent-current"
            aria-label="Storyboard shot scrubber"
          />
        </div>
      ) : null}

      {selected ? (
        <aside className="studio-inspector" aria-label="Selected panel">
          {selected.endpoint ? (
            <StoryboardHlsPreview endpoint={selected.endpoint} poster={selected.still} label={`${selected.title} motion preview`} />
          ) : selected.still ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.still} alt="" className="mb-3 aspect-video w-full rounded object-cover" />
          ) : (
            <div className="mb-3 aspect-video rounded bg-muted/40" />
          )}
          <p className="suite-kicker">{selected.kind}</p>
          <h3 className="text-lg font-medium text-foreground">{selected.title}</h3>
          {selected.time ? <p className="font-mono text-xs text-muted-foreground">{selected.time}</p> : null}
          {selectedPersisted ? (
            <div className="mt-3 grid gap-2">
              <Label htmlFor="panel-title">Title</Label>
              <Input id="panel-title" value={editorPanel.title ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, title: event.target.value })} />
              <Label htmlFor="panel-action">Transformation instruction</Label>
              <Textarea id="panel-action" className="min-h-20" value={editorPanel.action ?? editorPanel.description ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, action: event.target.value, description: event.target.value })} placeholder="Write the transformation yourself. Sentinel does not author this." />
              <Label htmlFor="panel-intent">Narrative intent</Label>
              <Input id="panel-intent" value={editorPanel.narrative_purpose ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, narrative_purpose: event.target.value })} />
              <Label htmlFor="panel-camera">Camera</Label>
              <Input id="panel-camera" value={editorPanel.camera ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, camera: event.target.value })} />
              <Label htmlFor="panel-movement">Movement</Label>
              <Input id="panel-movement" value={editorPanel.camera_movement ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, camera_movement: event.target.value })} />
              <Label htmlFor="panel-transition">Transition</Label>
              <Input id="panel-transition" value={editorPanel.transition ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, transition: event.target.value })} />
              <Label htmlFor="panel-duration">Duration (ms)</Label>
              <Input id="panel-duration" type="number" value={editorPanel.duration_ms ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, duration_ms: event.target.value ? Number(event.target.value) : null })} />
              <Label htmlFor="panel-dialogue">Dialogue</Label>
              <Input id="panel-dialogue" value={editorPanel.dialogue ?? ""} onChange={(event) => setDraftPanel({ ...selectedPersisted, ...draftPanel, panel_id: selectedPersisted.panel_id, dialogue: event.target.value })} />
              <Button type="button" size="sm" variant="outline" onClick={() => void savePanelEdits()}>
                Save panel
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
          )}
          {selected.camera ? <p className="mt-2 text-xs text-muted-foreground">Camera · {selected.camera}</p> : null}
          {selected.movement ? <p className="text-xs text-muted-foreground">Movement · {selected.movement}</p> : null}
          {selected.transition ? <p className="text-xs text-muted-foreground">Transition · {selected.transition}</p> : null}
          {selectedJob ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs" data-generation-status={selectedJob.status}>
                {jobUiLabel(selectedJob.status as never)}
                {selectedJob.progress != null ? ` · ${selectedJob.progress}%` : ""}
                {selectedJob.error?.message ? ` · ${selectedJob.error.message}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedJob.retryable || selectedJob.status === "failed" || selectedJob.status === "unavailable" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void fetch(`/api/authority/storyboard/jobs/${selectedJob.job_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry" }) }).then(async (response) => {
                    const payload = await response.json().catch(() => ({}));
                    if (payload.job_id) setJobs((current) => [payload, ...current.filter((job) => job.job_id !== payload.job_id)]);
                  })}>Retry</Button>
                ) : null}
                {selectedJob.status === "queued" || selectedJob.status === "submitted" || selectedJob.status === "processing" ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void fetch(`/api/authority/storyboard/jobs/${selectedJob.job_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })}>Cancel</Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">A generation cannot be undone at the provider. Undo restores local selection and keeps generated assets.</p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("still")}>
              Generate still
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void enqueue("animate-still")}>
              Animate still
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("clip")}>
              Generate motion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("animation")}>
              Generate animation
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void enqueue("first-last-frame")}>
              First / last frame
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void enqueue("reference-motion")}>
              Reference motion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void enqueue("extend")}>
              Extend
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("gif")}>
              Generate GIF
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("reel")}>
              Assemble reel
            </Button>
            {universeId ? (
              <>
                <Link href={creativeSuiteWorkspaceHref(universeId, "production")} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  Add to production
                </Link>
                <Link href={previewHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  2.5D Experience
                </Link>
              </>
            ) : null}
          </div>
          <details className="mt-3" data-storyboard-provenance="true">
            <summary className="cursor-pointer text-xs text-muted-foreground">Provenance</summary>
            <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Source</dt>
                <dd>{work?.sources?.[0]?.title || "None attached"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Sentinel</dt>
                <dd>{selectedSentinel ? `${selectedSentinel.title} · ${formatTimelineMs(selectedSentinel.time_ms)}` : "No selected observation"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Reference</dt>
                <dd>{selectedPersisted?.references[0]?.label || work?.frames?.[0]?.source_title || "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Transformation</dt>
                <dd>{(editorPanel.action || editorPanel.description || "Write this yourself").slice(0, 80)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Still</dt>
                <dd>{stillJob ? jobUiLabel(stillJob.status as never) : selected?.still ? "Attached" : "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Motion</dt>
                <dd>{motionJob ? jobUiLabel(motionJob.status as never) : selected?.endpoint ? "Attached" : "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Assembly</dt>
                <dd>{work?.assembly?.items?.length ? `${work.assembly.items.length} item${work.assembly.items.length === 1 ? "" : "s"}` : "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Canonical</dt>
                <dd>creates_scene = false</dd>
              </div>
            </dl>
          </details>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">Technical inspector</summary>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              work {work?.work_id ?? "—"} · panel {selectedId ?? "—"} · job {selectedJob?.job_id ?? "—"}
              {selectedJob?.result?.playback_id ? ` · mux ${selectedJob.result.playback_id}` : ""}
              {capability?.models ? ` · text ${capability.models.text} · image ${capability.models.image} · video ${capability.models.video}` : ""}
            </p>
            <button type="button" className="sr-only" onClick={() => setInspectorOpen(!inspectorOpen)}>
              Toggle inspector
            </button>
          </details>
          <StatusLine state={mediaState} />
        </aside>
      ) : null}
    </div>
  );
}

function StatusLine({ state }: { state: GenerationState }) {
  if (state.status === "idle") return null;
  const label =
    state.status === "queued" ? "Requested" :
    state.status === "generating" ? "Running" :
    state.status === "ready" ? "Succeeded" :
    state.status === "unavailable" || state.status === "needs_configuration" ? "Unavailable" :
    state.status === "blocked" ? "Blocked" :
    "Failed";
  return (
    <p className="text-xs text-muted-foreground" data-generation-status={state.status}>
      {label}. {state.message}
    </p>
  );
}

function StoryboardEvidencePanel({
  panel,
  selected,
  still,
  pending,
  onSelect,
  onGenerate,
}: {
  panel: StoryboardPanel;
  selected: boolean;
  still: string | null;
  pending: boolean;
  onSelect: () => void;
  onGenerate: () => void;
}) {
  const kindLabel = panel.kind === "scene" ? "Canonical Scene" : "Storyboard beat";
  return (
    <ShotFrame
      shotLabel={kindLabel}
      subtitle={panel.title}
      still={still}
      pending={pending}
      selected={selected}
      onSelect={onSelect}
      onGenerate={onGenerate}
      badge={kindLabel}
      panelKind={panel.kind}
      sceneId={panel.scene_master_id}
      caption={formatTimelineMs(panel.time_ms)}
    />
  );
}

function ShotFrame({
  shotLabel,
  subtitle,
  still,
  pending,
  selected,
  onSelect,
  onGenerate,
  badge,
  panelKind,
  sceneId,
  caption,
  status,
}: {
  shotLabel: string;
  subtitle: string;
  still: string | null;
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
  onGenerate: () => void;
  badge?: string;
  panelKind?: string;
  sceneId?: string | null;
  caption?: string;
  status?: string;
}) {
  return (
    <div className={cn("storyboard-panel", selected && "storyboard-panel-current")}>
      <button
        type="button"
        className="storyboard-panel-hit"
        data-panel-kind={panelKind}
        data-scene-id={sceneId ?? undefined}
        onClick={onSelect}
      >
        <div className="storyboard-panel-frame">
          {still ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={still} alt="" />
          ) : (
            <div className="storyboard-panel-empty flex items-center justify-center text-xs text-muted-foreground">
              {pending ? "Pending…" : "Pending…"}
            </div>
          )}
          <div className="storyboard-panel-overlay">
            <p>{shotLabel}</p>
            <p>{subtitle}</p>
          </div>
        </div>
      </button>
      <div className="storyboard-panel-meta">
        <div className="min-w-0">
          {badge ? (
            <p className={badge === "Canonical Scene" || badge === "Scene" ? "suite-canon-badge" : "suite-proposal-badge"}>
              {badge}
            </p>
          ) : (
            <p>{shotLabel}</p>
          )}
          <p className="truncate">{subtitle}</p>
          {status ? <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{panelUiLabel(status as never)}</p> : null}
          {caption ? <p className="font-mono text-[10px] text-muted-foreground">{caption}</p> : null}
        </div>
        <Button type="button" size="sm" className="h-7 shrink-0 text-[10px]" variant={selected ? "default" : "outline"} disabled={pending} onClick={onGenerate}>
          {pending ? "Pending…" : "GENERATE"}
        </Button>
      </div>
    </div>
  );
}

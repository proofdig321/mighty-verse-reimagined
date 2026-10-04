"use client";

import type { Dispatch, SetStateAction } from "react";
import { chromePromptAvailability, promptWithChrome } from "@/lib/ai/chrome";
import type { GenerationJobKind } from "@/lib/ai/jobs";
import { jobUiLabel } from "@/lib/ai/jobs";
import type { SuiteScene } from "@/lib/assemble/suite";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import type { StoryboardOutputType } from "@/lib/storyboard/artifact";
import { operatorGenerationMessage } from "@/lib/storyboard/operator-error";
import { catalogForChrome, GALLERY_THEME_SYSTEM, parseChromeThemeMatch, pickGalleryTheme } from "@/lib/storyboard/gallery-theme";
import type { StoryboardPanelRecord, StoryboardWorkRecord } from "@/lib/storyboard/document";
import type { StoryboardScriptPanel } from "@/lib/storyboard/script";
import type { StoryboardJobCard } from "./use-storyboard-job-lifecycle";
import type { StoryboardSelectionPresentation } from "@/lib/storyboard/selection";

type GenerationState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

type StoryboardArtifact = {
  still_url: string | null;
  playback_id?: string | null;
};

export function useStoryboardGenerationOperations({
  universeId,
  work,
  script,
  selectedId,
  selected,
  selectedPersisted,
  selectedJob,
  draftPanel,
  instruction,
  firstFrame,
  lastFrame,
  durationSeconds,
  aspectRatio,
  resolution,
  references,
  generated,
  workFrames,
  persistedPanels,
  scriptPanels,
  sentinelPanels,
  scenes,
  panelStills,
  saveBody,
  setJobs,
  setMediaState,
  setPanelStills,
  setPendingPanels,
  setSelectedId,
}: {
  universeId: string | null;
  work: StoryboardWorkRecord | null;
  script: string;
  selectedId: string | null;
  selected: StoryboardSelectionPresentation | null;
  selectedPersisted: StoryboardPanelRecord | null;
  selectedJob: StoryboardJobCard | null;
  draftPanel: Partial<StoryboardPanelRecord>;
  instruction: string;
  firstFrame: string;
  lastFrame: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution: string;
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  generated: StoryboardArtifact[];
  workFrames: { still_url: string }[];
  persistedPanels: StoryboardPanelRecord[];
  scriptPanels: StoryboardScriptPanel[];
  sentinelPanels: SentinelIntelligence["storyboard"];
  scenes: SuiteScene[];
  panelStills: Record<string, string>;
  saveBody: () => Promise<StoryboardWorkRecord | null>;
  setJobs: Dispatch<SetStateAction<StoryboardJobCard[]>>;
  setMediaState: Dispatch<SetStateAction<GenerationState>>;
  setPanelStills: Dispatch<SetStateAction<Record<string, string>>>;
  setPendingPanels: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSelectedId: (id: string | null) => void;
}) {
  async function enqueue(kind: GenerationJobKind, extra: Record<string, unknown> = {}) {
    const saved = await saveBody();
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
          ...workFrames.map((frame) => frame.still_url),
          ...(selectedPersisted?.references ?? []).map((ref) => ref.url).filter(Boolean),
        ].filter(Boolean),
        still_urls: generated.map((artifact) => artifact.still_url).filter(Boolean),
        playback_ids: generated.map((artifact) => artifact.playback_id).filter(Boolean),
        extension_video_uri: extra.extension_video_uri ?? selectedJob?.result?.provider_video_uri ?? undefined,
        instruction: extra.instruction ?? draftPanel.generation_metadata?.transformation_instruction ?? selectedPersisted?.generation_metadata?.transformation_instruction ?? instruction,
        ...extra,
        duration_seconds: typeof extra.duration_seconds === "number" ? extra.duration_seconds : durationSeconds,
        aspect_ratio: extra.aspect_ratio === "9:16" || extra.aspect_ratio === "16:9" ? extra.aspect_ratio : aspectRatio,
        resolution: typeof extra.resolution === "string" ? extra.resolution : resolution,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (payload.job_id) setJobs((current) => [payload, ...current.filter((job) => job.job_id !== payload.job_id)]);
    const jobStatus = typeof payload.status === "string" ? payload.status : "";
    const honestFailure = ["failed", "blocked", "needs_configuration", "unavailable", "cancelled"].includes(jobStatus);
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

  return { enqueue, generateMedia, generateShot };
}

"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { chromePromptAvailability, promptWithChrome, STORYBOARD_SYSTEM } from "@/lib/ai/chrome";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { SentinelIntelligence } from "@/lib/media/sentinel-intelligence";
import type { StoryboardWorkRecord } from "@/lib/storyboard/document";
import { composeStoryboardBody, type StoryboardScriptPanel } from "@/lib/storyboard/script";
import { catalogForChrome } from "@/lib/storyboard/gallery-theme";
export type StoryboardActionState = {
  status: "idle" | "generating" | "ready" | "failed" | "unavailable" | "queued" | "blocked" | "needs_configuration";
  message: string;
};

export function useStoryboardAuthoringOperations({
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
}: {
  universeId: string | null;
  universeTitle?: string | null;
  work: StoryboardWorkRecord | null;
  script: string;
  instruction: string;
  selectedId: string | null;
  selectedPersisted: StoryboardWorkRecord["panels"][number] | null;
  references: { asset_id: string; title: string; role: string; still_url: string | null }[];
  assistConfigured: boolean;
  sentinelPanels: SentinelIntelligence["storyboard"];
  scenes: SuiteScene[];
  applyWork: (work: StoryboardWorkRecord, preferredPanelId?: string | null) => void;
  setScript: Dispatch<SetStateAction<string>>;
  setScriptPanels: Dispatch<SetStateAction<StoryboardScriptPanel[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setSaveState: Dispatch<SetStateAction<StoryboardActionState>>;
}) {
  const [assistState, setAssistState] = useState<StoryboardActionState>({ status: "idle", message: "" });
  const [assistProposal, setAssistProposal] = useState<string | null>(null);

  function generatePanelsLocal(body = script) {
    const composed = composeStoryboardBody(body);
    setScriptPanels(composed.panels);
    setSelectedId(composed.panels[0]?.panel_id ?? sentinelPanels[0]?.panel_id ?? scenes[0]?.master_id ?? null);
  }

  async function generateStoryboard() {
    generatePanelsLocal();
    setSaveState({ status: "generating", message: "Generating structured storyboard…" });
    try {
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
        setSaveState({
          status: payload.status === "unavailable" || payload.status === "needs_configuration" ? "unavailable" : "failed",
          message: payload.error ?? "Storyboard generation failed.",
        });
        return;
      }
      setSaveState({
        status: payload.error ? "unavailable" : "ready",
        message: payload.error
          ? `${payload.error} Local panels were kept. This is not a Scene.`
          : "Structured panels saved. They are not canonical Scenes.",
      });
    } catch (error) {
      setSaveState({
        status: "failed",
        message: error instanceof Error ? error.message : "Storyboard generation failed.",
      });
    }
  }

  async function assist(actionId = "assist") {
    setAssistState({ status: "generating", message: "Asking the configured Google/Chrome AI…" });
    const chromeSupported = ["assist", "improve", "expand", "condense"].includes(actionId);
    if (chromeSupported) {
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
          setAssistState({ status: "ready", message: "Review the proposed story edit before applying it." });
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

    try {
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
        setAssistState({ status: "ready", message: "Review the Gemini proposal before applying it." });
        return;
      }
      if (payload.work) applyWork(payload.work);
      else {
        setScript(payload.body ?? "");
        setScriptPanels(payload.panels ?? []);
      }
      setAssistState({ status: "ready", message: "Suggestion applied. It did not create Scenes." });
    } catch (error) {
      setAssistState({
        status: "failed",
        message: error instanceof Error ? error.message : "AI assist could not complete.",
      });
    }
  }

  function applyAssistProposal() {
    if (assistProposal === null) return;
    setScript(assistProposal);
    setDirty(true);
    setAssistProposal(null);
  }

  function dismissAssistProposal() {
    setAssistProposal(null);
    setAssistState({ status: "idle", message: "Proposal discarded." });
  }

  return {
    assistState,
    assistProposal,
    generateStoryboard,
    assist,
    applyAssistProposal,
    dismissAssistProposal,
  };
}

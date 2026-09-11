"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { SentinelIntelligence, StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import { composeStoryboardBody, type StoryboardScriptPanel } from "@/lib/storyboard/script";
import { chromePromptAvailability, promptWithChrome, STORYBOARD_SYSTEM } from "@/lib/ai/chrome";
import type { StoryboardOutputType } from "@/lib/storyboard/artifact";
import { SentinelIntelligencePanel } from "./sentinel-intelligence";
import { AssociateStoryboard } from "./associate-storyboard";
import { creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { cn } from "@/lib/utils";

type MaterialTab = "script" | "assist" | "sentinel" | "references";
type GenerationState = { status: "idle" | "generating" | "ready" | "failed" | "unavailable"; message: string };

type StoryboardArtifactCard = {
  title: string;
  output_type: string;
  still_url: string | null;
  status: string;
};

export function StoryboardWorkspace({
  universeId,
  universeTitle,
  scenes,
  intelligence,
  canAuthoriseSentinel,
  inspectHref,
  previewHref,
  references,
  initialTab = "script",
  initialBody = "",
  artifacts = [],
  assistConfigured = false,
  universes = [],
}: {
  universeId: string | null;
  universeTitle?: string | null;
  scenes: SuiteScene[];
  intelligence: SentinelIntelligence | null;
  canAuthoriseSentinel: boolean;
  inspectHref?: string | null;
  previewHref: string;
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  initialTab?: MaterialTab;
  initialBody?: string;
  artifacts?: StoryboardArtifactCard[];
  assistConfigured?: boolean;
  universes?: { master_id: string; title: string }[];
}) {
  const [tab, setTab] = useState<MaterialTab>(initialTab);
  const [script, setScript] = useState(initialBody);
  const [scriptPanels, setScriptPanels] = useState<StoryboardScriptPanel[]>(
    initialBody ? composeStoryboardBody(initialBody).panels : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistState, setAssistState] = useState<GenerationState>({ status: "idle", message: "" });
  const [saveState, setSaveState] = useState<GenerationState>({ status: "idle", message: "" });
  const [mediaState, setMediaState] = useState<GenerationState>({ status: "idle", message: "" });
  const [generated, setGenerated] = useState<StoryboardArtifactCard[]>(artifacts);

  const sentinelPanels = intelligence?.storyboard ?? [];
  const selectedSentinel = sentinelPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScript = scriptPanels.find((panel) => panel.panel_id === selectedId) ?? null;
  const selectedScene = scenes.find((scene) => scene.master_id === selectedId) ?? null;

  const selected = useMemo(() => {
    if (selectedScript) {
      return {
        title: selectedScript.title,
        description: selectedScript.description,
        time: null as string | null,
        kind: "Script beat",
        still: null as string | null,
        camera: selectedScript.camera,
        movement: selectedScript.movement,
        transition: selectedScript.transition,
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
        still: selectedSentinel.still_url,
        camera: null,
        movement: null,
        transition: null,
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
        still: null,
        camera: null,
        movement: null,
        transition: null,
      };
    }
    return null;
  }, [selectedScript, selectedSentinel, selectedScene]);

  function generatePanels() {
    const composed = composeStoryboardBody(script);
    setScriptPanels(composed.panels);
    setSelectedId(composed.panels[0]?.panel_id ?? sentinelPanels[0]?.panel_id ?? scenes[0]?.master_id ?? null);
    setSaveState({ status: "idle", message: "" });
  }

  async function saveBody(nextBody = script) {
    setSaveState({ status: "generating", message: "Saving story body…" });
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: universeId, action: "save", body: nextBody }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveState({ status: "failed", message: payload.error ?? "Could not save the story body." });
      return false;
    }
    setSaveState({ status: "ready", message: "Story body saved as a creative artifact. It is not a Scene." });
    return true;
  }

  async function assist() {
    setAssistState({ status: "generating", message: "Asking the configured Google/Chrome AI…" });
    const chrome = await chromePromptAvailability();
    if (chrome.text) {
      const result = await promptWithChrome({
        system: STORYBOARD_SYSTEM,
        prompt: [
          `Universe: ${universeTitle ?? "Untitled"}`,
          script ? `Current story body:\n${script}` : "No current story body.",
          instruction || "Write a cinematic storyboard story body.",
        ].join("\n\n"),
      });
      if (result.ok) {
        setScript(result.text);
        setScriptPanels(composeStoryboardBody(result.text).panels);
        setAssistState({ status: "ready", message: "Chrome built-in AI refined the story body. It did not create Scenes." });
        await saveBody(result.text);
        return;
      }
    }
    if (!assistConfigured && !chrome.text) {
      setAssistState({
        status: "unavailable",
        message: "Chrome Prompt API is not available here, and Gemini is not configured on the server.",
      });
      return;
    }
    const response = await fetch("/api/authority/storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        action: "assist",
        body: script,
        instruction,
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
    setScript(payload.body ?? "");
    setScriptPanels(payload.panels ?? []);
    setAssistState({ status: "ready", message: "Gemini refined the story body. It did not create Scenes." });
  }

  async function generateMedia(outputType: StoryboardOutputType) {
    const still = selected?.still ?? references[0]?.still_url ?? sentinelPanels.find((panel) => panel.still_url)?.still_url ?? null;
    const stillUrls = sentinelPanels.map((panel) => panel.still_url).filter(Boolean) as string[];
    setMediaState({ status: "generating", message: `Generating ${outputType}…` });
    const response = await fetch("/api/authority/storyboard/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        output_type: outputType,
        prompt: selected?.description ?? script,
        title: selected?.title ?? "Storyboard artifact",
        panel_id: selectedId,
        still_url: still,
        still_urls: outputType === "reel" ? stillUrls : still ? [still] : [],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMediaState({
        status: payload.status === "unavailable" ? "unavailable" : "failed",
        message: payload.error ?? "Generation did not complete.",
      });
      return;
    }
    setGenerated((current) => [
      { title: selected?.title ?? "Storyboard artifact", output_type: outputType, still_url: payload.still_url ?? still, status: "ready" },
      ...current,
    ]);
    setMediaState({ status: "ready", message: `${outputType} is on Mux. It is an artifact, not a Scene.` });
  }

  const tabs: { id: MaterialTab; label: string }[] = [
    { id: "script", label: "Script" },
    { id: "assist", label: "AI Assist" },
    { id: "sentinel", label: "Sentinel" },
    { id: "references", label: "References" },
  ];

  return (
    <div className="storyboard-workspace">
      <div className="storyboard-target-bar">
        {universeId ? (
          <p className="text-sm text-muted-foreground">
            Target Association · {universeTitle ?? "Canonical Universe"}
          </p>
        ) : (
          <AssociateStoryboard universes={universes} />
        )}
      </div>

      <div className="studio-material-tabs" role="tablist" aria-label="Storyboard materials">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn("studio-material-tab", tab === item.id && "studio-material-tab-current")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="storyboard-workspace-columns">
        <section
          className={cn("storyboard-column", (tab === "script" || tab === "assist") && "storyboard-column-current")}
          data-column="script"
          aria-labelledby="storyboard-script-heading"
        >
          <p className="suite-kicker">Ingest</p>
          <h2 id="storyboard-script-heading" className="suite-section-title">
            Script
          </h2>
          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="suite-kicker">Story body</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                rows={10}
                className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground"
                placeholder="Golden Shovel walks a futuristic Johannesburg skyline.&#10;Camera: rise through the mural&#10;The city transforms around him.&#10;Spirit avatar appears."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={generatePanels}>
                Generate storyboard
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void saveBody()}>
                Save story body
              </Button>
            </div>
            <StatusLine state={saveState} />
            <p className="suite-section-note">
              Script is a creative input. Generating panels does not create Scenes or change canonical timing.
            </p>
            <label className="block space-y-2">
              <span className="suite-kicker">AI Assist</span>
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground"
                placeholder="Tighten the Powerhouse opening. Keep the four existing Scenes as the destination, not as generated objects."
              />
            </label>
            <Button type="button" size="sm" onClick={() => void assist()}>
              Generate / refine story
            </Button>
            <StatusLine state={assistState} />
            <p className="suite-section-note">
              Uses Chrome built-in Prompt API when the browser can, otherwise the configured Gemini API.
              AI output remains a proposal until you curate it.
            </p>
          </div>
        </section>

        <section
          className={cn("storyboard-column", tab === "sentinel" && "storyboard-column-current")}
          data-column="sentinel"
          aria-labelledby="universe-sentinel"
        >
          {intelligence && universeId ? (
            <div className="suite-section">
              <div className="suite-section-head">
                <h2 id="universe-sentinel" className="suite-section-title">
                  Sentinel
                </h2>
                <p className="suite-section-note">
                  Observational evidence for this source. Sentinel does not create Scenes. Authorise windows only when the curator agrees.
                </p>
              </div>
              <SentinelIntelligencePanel
                universeId={universeId}
                intelligence={intelligence}
                canAuthorise={canAuthoriseSentinel}
                canRetainReference={canAuthoriseSentinel}
                inspectHref={inspectHref}
                previewHref={previewHref}
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

        <section
          className={cn(
            "storyboard-column",
            (tab === "script" || tab === "assist" || tab === "references") && "storyboard-column-current",
          )}
          data-column="sequence"
          aria-labelledby="storyboard-sequence"
        >
          <div className="suite-section-head">
            <h2 id="storyboard-sequence" className="suite-section-title">
              Storyboard
            </h2>
            <p className="suite-section-note">
              A visual sequence for this work. Script beats, Sentinel evidence, and canonical Scenes are materials — not the same thing.
            </p>
          </div>
          <ol className="storyboard-panel-strip">
            {scriptPanels.map((panel, index) => (
              <li key={panel.panel_id}>
                <button
                  type="button"
                  className={cn("storyboard-panel", selectedId === panel.panel_id && "storyboard-panel-current")}
                  onClick={() => setSelectedId(panel.panel_id)}
                >
                  <div className="storyboard-panel-empty" aria-hidden="true" />
                  <p className="suite-kicker">Panel {String(index + 1).padStart(2, "0")}</p>
                  <p className="text-sm text-foreground">{panel.title}</p>
                  <p className="suite-proposal-badge">Script</p>
                </button>
              </li>
            ))}
            {sentinelPanels.map((panel) => (
              <li key={panel.panel_id}>
                <StoryboardEvidencePanel
                  panel={panel}
                  selected={selectedId === panel.panel_id}
                  onSelect={() => setSelectedId(panel.panel_id)}
                />
              </li>
            ))}
            {scriptPanels.length === 0 && sentinelPanels.length === 0
              ? scenes.map((scene, index) => (
                  <li key={scene.master_id}>
                    <button
                      type="button"
                      className={cn("storyboard-panel", selectedId === scene.master_id && "storyboard-panel-current")}
                      onClick={() => setSelectedId(scene.master_id)}
                    >
                      <p className="suite-kicker">{String(index + 1).padStart(2, "0")}</p>
                      <p className="text-sm text-foreground">{sceneShortTitle(scene.title) ?? scene.title ?? "Untitled"}</p>
                      <p className="suite-canon-badge">Scene</p>
                    </button>
                  </li>
                ))
              : null}
          </ol>
          {scriptPanels.length === 0 && sentinelPanels.length === 0 && scenes.length === 0 ? (
            <p className="suite-empty">Write a script or inspect source media to begin a storyboard.</p>
          ) : null}

          <div className={cn("mt-6", tab !== "references" && "storyboard-references")}>
            <p className="suite-kicker">Media compositions</p>
            {references.length === 0 && generated.length === 0 ? (
              <p className="suite-empty">No curated references yet. Keep a Sentinel still as a reference from the Sentinel materials.</p>
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
                      {reference.role} · {formatTimelineMs(reference.time_ms)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected ? (
            <aside className="studio-inspector mt-6" aria-label="Selected panel">
              {selected.still ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.still} alt="" className="mb-3 aspect-video w-full rounded object-cover" />
              ) : (
                <div className="mb-3 aspect-video rounded bg-muted/40" />
              )}
              <p className="suite-kicker">{selected.kind}</p>
              <h3 className="text-lg font-medium text-foreground">{selected.title}</h3>
              {selected.time ? <p className="font-mono text-xs text-muted-foreground">{selected.time}</p> : null}
              <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
              {selected.camera ? <p className="mt-2 text-xs text-muted-foreground">Camera · {selected.camera}</p> : null}
              {selected.movement ? <p className="text-xs text-muted-foreground">Movement · {selected.movement}</p> : null}
              {selected.transition ? <p className="text-xs text-muted-foreground">Transition · {selected.transition}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("panel")}>
                  Generate panel
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("variation")}>
                  Generate variation
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("animation")}>
                  Animate
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("clip")}>
                  Generate clip
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("gif")}>
                  Generate GIF
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void generateMedia("reel")}>
                  Generate reel
                </Button>
                {universeId ? (
                  <>
                    <Link href={creativeSuiteWorkspaceHref(universeId, "production")} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                      Add to production
                    </Link>
                    <Link href={previewHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                      Open 2.5D
                    </Link>
                  </>
                ) : null}
              </div>
              <StatusLine state={mediaState} />
            </aside>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatusLine({ state }: { state: GenerationState }) {
  if (state.status === "idle") return null;
  const label =
    state.status === "generating" ? "Generating" :
    state.status === "ready" ? "Generated" :
    state.status === "unavailable" ? "Unavailable" :
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
  onSelect,
}: {
  panel: StoryboardPanel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("storyboard-panel", selected && "storyboard-panel-current")}
      data-panel-kind={panel.kind}
      data-scene-id={panel.scene_master_id ?? undefined}
      onClick={onSelect}
    >
      {panel.still_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={panel.still_url} alt="" />
      ) : (
        <div className="storyboard-panel-empty" />
      )}
      <p className={panel.kind === "scene" ? "suite-canon-badge" : "suite-proposal-badge"}>
        {panel.kind === "scene" ? "Canonical Scene" : "Storyboard beat"}
      </p>
      <p className="text-sm text-foreground">{panel.title}</p>
      <p className="font-mono text-[10px] text-muted-foreground">{formatTimelineMs(panel.time_ms)}</p>
    </button>
  );
}

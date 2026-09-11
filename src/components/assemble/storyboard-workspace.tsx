"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Images, Pause, Play, Shield, SkipBack, SkipForward, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const [panelStills, setPanelStills] = useState<Record<string, string>>({});
  const [pendingPanels, setPendingPanels] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);

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
        still: panelStills[selectedScript.panel_id] ?? null,
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
        still: panelStills[selectedSentinel.panel_id] ?? selectedSentinel.still_url,
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
        still: panelStills[selectedScene.master_id] ?? null,
        camera: null,
        movement: null,
        transition: null,
      };
    }
    return null;
  }, [selectedScript, selectedSentinel, selectedScene, panelStills]);

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
          `Gallery artifacts (visual themes):\n${catalogForChrome(references)}`,
          instruction || "Write a cinematic storyboard story body that can be pictured from the gallery artifacts.",
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

  async function generateMedia(
    outputType: StoryboardOutputType,
    target?: { panelId: string | null; title: string; description: string; still: string | null },
  ) {
    const panelId = target?.panelId ?? selectedId;
    const title = target?.title ?? selected?.title ?? "Storyboard artifact";
    const description = target?.description ?? selected?.description ?? script;
    const still =
      target?.still ??
      selected?.still ??
      references[0]?.still_url ??
      sentinelPanels.find((panel) => panel.still_url)?.still_url ??
      null;
    const stillUrls = [
      ...references.map((reference) => reference.still_url).filter(Boolean),
      ...sentinelPanels.map((panel) => panel.still_url).filter(Boolean),
    ] as string[];
    setMediaState({ status: "generating", message: `Generating ${outputType}…` });
    const response = await fetch("/api/authority/storyboard/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        universe_id: universeId,
        output_type: outputType,
        prompt: description,
        title,
        panel_id: panelId,
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
    if (panelId && (payload.still_url || still)) {
      setPanelStills((current) => ({ ...current, [panelId]: payload.still_url ?? still }));
    }
    setGenerated((current) => [
      { title, output_type: outputType, still_url: payload.still_url ?? still, status: "ready" },
      ...current,
    ]);
    setMediaState({ status: "ready", message: `${outputType} is linked from gallery / Mux. It is an artifact, not a Scene.` });
  }

  async function generateShot(panelId: string) {
    const scriptPanel = scriptPanels.find((panel) => panel.panel_id === panelId);
    const sentinelPanel = sentinelPanels.find((panel) => panel.panel_id === panelId);
    const scene = scenes.find((item) => item.master_id === panelId);
    const title = scriptPanel?.title ?? sentinelPanel?.title ?? sceneShortTitle(scene?.title) ?? "Storyboard shot";
    const description = scriptPanel?.description ?? sentinelPanel?.title ?? scene?.description ?? title;
    setPendingPanels((current) => ({ ...current, [panelId]: true }));
    setSelectedId(panelId);
    let still = panelStills[panelId] ?? sentinelPanel?.still_url ?? pickGalleryTheme({ title, description }, references)?.still_url ?? null;
    const chrome = await chromePromptAvailability();
    if (!still && chrome.text && references.some((reference) => reference.still_url)) {
      const result = await promptWithChrome({
        system: GALLERY_THEME_SYSTEM,
        prompt: [`Beat: ${title}`, description, `Gallery artifacts:\n${catalogForChrome(references)}`, "Reply with the matching artifact title only."].join("\n\n"),
      });
      if (result.ok) {
        still = parseChromeThemeMatch(result.text, references)?.still_url ?? still;
      }
    }
    if (still) setPanelStills((current) => ({ ...current, [panelId]: still }));
    await generateMedia("panel", { panelId, title, description, still });
    setPendingPanels((current) => ({ ...current, [panelId]: false }));
  }

  const tabs: { id: MaterialTab; label: string; icon: typeof FileText }[] = [
    { id: "script", label: "Script", icon: FileText },
    { id: "assist", label: "AI Assist", icon: Sparkles },
    { id: "sentinel", label: "Sentinel", icon: Shield },
    { id: "references", label: "References", icon: Images },
  ];
  const sequenceEmpty = scriptPanels.length === 0 && sentinelPanels.length === 0 && scenes.length === 0;
  const shotIds = [
    ...scriptPanels.map((panel) => panel.panel_id),
    ...sentinelPanels.map((panel) => panel.panel_id),
    ...(scriptPanels.length === 0 && sentinelPanels.length === 0 ? scenes.map((scene) => scene.master_id) : []),
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

  return (
    <div className="storyboard-workspace" data-storyboard-layout="workspace">
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
                Write a story, parse Sentinel tracks, and generate promotional content independently.
              </p>
            </div>
            <Card className="w-full bg-card/60 lg:max-w-md" size="sm">
              <CardContent>
                <AssociateStoryboard universes={universes} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="storyboard-stage">
        <Card className="flex min-h-0 flex-col bg-card/70">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="uppercase tracking-[0.16em]">Script & Narrative</CardTitle>
            <CardDescription>Draft the story. Chrome Prompt API reads gallery artifact themes when you GENERATE a shot.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pt-4">
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (value === "script" || value === "assist" || value === "sentinel" || value === "references") {
                  setTab(value);
                }
              }}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              <TabsList className="h-auto w-full justify-start gap-1" aria-label="Storyboard materials">
                {tabs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger key={item.id} value={item.id} className="gap-1.5">
                      <Icon size={13} />
                      {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="script" className="space-y-4">
                <section data-column="script" aria-labelledby="storyboard-script-heading" className="space-y-3">
                  <h3 id="storyboard-script-heading" className="sr-only">
                    Script
                  </h3>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Story body</span>
                    <Textarea
                      value={script}
                      onChange={(event) => setScript(event.target.value)}
                      className="min-h-[28rem] flex-1 font-mono text-sm leading-relaxed"
                      placeholder="SCENE 1: EXT. CITY STREET — NIGHT&#10;The detective walks the mural. Camera: close-up.&#10;GENERATE stills from gallery artifacts, not invented pictures."
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
                  <p className="text-xs text-muted-foreground">
                    Script is a creative input. Generating panels does not create Scenes or change canonical timing.
                  </p>
                </section>
              </TabsContent>

              <TabsContent value="assist" className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">AI Assist</span>
                  <Textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    className="min-h-28 text-sm"
                    placeholder="Tighten the Powerhouse opening. Keep the four existing Scenes as the destination, not as generated objects."
                  />
                </label>
                <Button type="button" size="sm" onClick={() => void assist()}>
                  Generate / refine story
                </Button>
                <StatusLine state={assistState} />
                <p className="text-xs text-muted-foreground">
                  Chrome Prompt API is the intended path. Gemini is used only when that browser API is unavailable and a server key is configured. AI output remains a proposal until you curate it.
                </p>
              </TabsContent>

              <TabsContent value="sentinel">
                <section data-column="sentinel" aria-labelledby="universe-sentinel" className="space-y-3">
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
              </TabsContent>

              <TabsContent value="references" className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">References</p>
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
                          {reference.role} · {formatTimelineMs(reference.time_ms)}
                        </p>
                        {selectedId && reference.still_url ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 w-full text-[10px]"
                            onClick={() => {
                              setPanelStills((current) => ({ ...current, [selectedId]: reference.still_url as string }));
                              setMediaState({ status: "ready", message: "Gallery artifact linked to the selected shot. It is not a Scene." });
                            }}
                          >
                            Use on shot
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
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
              GENERATE links each shot to a gallery artifact. Text-to-animation uses those stills as the visual theme.
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
                {scriptPanels.length === 0 && sentinelPanels.length === 0
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
          {caption ? <p className="font-mono text-[10px] text-muted-foreground">{caption}</p> : null}
        </div>
        <Button type="button" size="sm" className="h-7 shrink-0 text-[10px]" variant={selected ? "default" : "outline"} disabled={pending} onClick={onGenerate}>
          {pending ? "Pending…" : "GENERATE"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatTimelineMs } from "@/lib/media/timing";
import { sceneShortTitle } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import type { SentinelIntelligence, StoryboardPanel } from "@/lib/media/sentinel-intelligence";
import { SentinelIntelligencePanel } from "./sentinel-intelligence";
import { creativeSuiteWorkspaceHref } from "@/lib/assemble/studio";
import { cn } from "@/lib/utils";

type MaterialTab = "script" | "assist" | "sentinel" | "references";

type ScriptPanel = {
  panel_id: string;
  title: string;
  description: string;
  source: "script";
};

function panelsFromScript(script: string): ScriptPanel[] {
  return script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      panel_id: `script-${index + 1}`,
      title: line.slice(0, 72),
      description: line,
      source: "script" as const,
    }));
}

export function StoryboardWorkspace({
  universeId,
  scenes,
  intelligence,
  canAuthoriseSentinel,
  inspectHref,
  previewHref,
  references,
  initialTab = "script",
}: {
  universeId: string;
  scenes: SuiteScene[];
  intelligence: SentinelIntelligence | null;
  canAuthoriseSentinel: boolean;
  inspectHref?: string | null;
  previewHref: string;
  references: { asset_id: string; title: string; role: string; time_ms: number; still_url: string | null }[];
  initialTab?: MaterialTab;
}) {
  const [tab, setTab] = useState<MaterialTab>(initialTab);
  const [script, setScript] = useState("");
  const [scriptPanels, setScriptPanels] = useState<ScriptPanel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      };
    }
    return null;
  }, [selectedScript, selectedSentinel, selectedScene]);

  function generate() {
    const next = panelsFromScript(script);
    setScriptPanels(next);
    setSelectedId(next[0]?.panel_id ?? sentinelPanels[0]?.panel_id ?? scenes[0]?.master_id ?? null);
  }

  const tabs: { id: MaterialTab; label: string }[] = [
    { id: "script", label: "Script" },
    { id: "assist", label: "AI Assist" },
    { id: "sentinel", label: "Sentinel" },
    { id: "references", label: "References" },
  ];

  return (
    <div className="storyboard-workspace">
      <section className="suite-section" aria-labelledby="storyboard-materials">
        <p className="suite-kicker">Materials</p>
        <h2 id="storyboard-materials" className="sr-only">
          Storyboard materials
        </h2>
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

        {tab === "script" ? (
          <div className="mt-4 space-y-3">
            <label className="block space-y-2">
              <span className="suite-kicker">Script</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-foreground"
                placeholder="Scene 1: Golden Shovel walks through a futuristic Johannesburg skyline.&#10;The city transforms around him.&#10;Camera rises.&#10;Spirit avatar appears."
              />
            </label>
            <Button type="button" size="sm" onClick={generate}>
              Generate storyboard
            </Button>
            <p className="suite-section-note">
              Script is a creative input. Generating panels does not create Scenes or change canonical timing.
            </p>
          </div>
        ) : null}

        {tab === "assist" ? (
          <div className="mt-4 space-y-3">
            <p className="suite-section-note">
              AI script assist is not connected. Write a script, or use Sentinel evidence as materials. Sentinel observes; it does not author the work.
            </p>
          </div>
        ) : null}

        {tab === "sentinel" ? (
          <div className="mt-4">
            {intelligence ? (
              <section className="suite-section" aria-labelledby="universe-sentinel">
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
              </section>
            ) : (
              <p className="suite-empty">No Sentinel evidence is available yet. Inspect the bound source to observe it.</p>
            )}
          </div>
        ) : null}

        {tab === "references" ? (
          <div className="mt-4">
            {references.length === 0 ? (
              <p className="suite-empty">No curated references yet. Keep a Sentinel still as a reference from the Sentinel materials.</p>
            ) : (
              <ul className="flex flex-wrap gap-3">
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
        ) : null}
      </section>

      <section className="suite-section" aria-labelledby="storyboard-sequence">
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
                <p className="suite-kicker">{String(index + 1).padStart(2, "0")}</p>
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
      </section>

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
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={creativeSuiteWorkspaceHref(universeId, "production")} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Add to production
            </Link>
            <Link href={previewHref} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
              Open 2.5D
            </Link>
          </div>
        </aside>
      ) : null}
    </div>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { sceneShortTitle, sceneStillUrl } from "@/lib/assemble/composition";
import type { SuiteScene } from "@/lib/assemble/suite";
import { providerThumbnailUrl } from "@/lib/media/thumbnail";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { HolographicStage } from "@/components/experience/holographic-stage";
import { CreativeStill } from "./creative-still";
import { SourcePreview } from "./source-preview";
import { cn } from "@/lib/utils";
import type { SuiteSourcePreview } from "@/lib/assemble/load-source-preview";
import type { HolographicPlayback } from "@/components/experience/holographic-layer-media";

export function StudioPreview({
  universeTitle,
  scenes,
  layers,
  experienceHref,
  universeHref,
  source = null,
}: {
  universeTitle: string;
  scenes: SuiteScene[];
  layers: HolographicLayer[];
  experienceHref: string;
  universeHref: string;
  source?: SuiteSourcePreview | null;
}) {
  const [mode, setMode] = useState<"2d" | "2.5d">("2.5d");
  const playback: HolographicPlayback | null = source
    ? {
        playback_id: source.playback_id,
        endpoint_ref: source.endpoint_ref,
        projection_id: source.mural_projection_id,
        master_id: source.mural_id,
        canonical_state_id: source.mural_canonical_state_id ?? source.mural_id,
      }
    : null;

  return (
    <div className="suite-studio-preview" data-suite-studio-preview="">
      <div className="suite-preview-toggle" role="group" aria-label="Studio composition preview">
        <button
          type="button"
          aria-pressed={mode === "2d"}
          className={cn("suite-preview-mode", mode === "2d" && "suite-preview-mode-current")}
          onClick={() => setMode("2d")}
        >
          2D composition
        </button>
        <button
          type="button"
          aria-pressed={mode === "2.5d"}
          className={cn("suite-preview-mode", mode === "2.5d" && "suite-preview-mode-current")}
          onClick={() => setMode("2.5d")}
        >
          2.5D Studio Preview
        </button>
      </div>

      {mode === "2.5d" ? (
        <HolographicStage title={universeTitle} layers={layers} playback={playback} />
      ) : source ? (
        <div className="space-y-4">
          <SourcePreview source={source} />
          <ol className="suite-preview-2d">
            {scenes.map((scene, index) => {
              const still = sceneStillUrl(scene);
              const url = still
                ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 640 })
                : null;
              return (
                <li key={scene.master_id} data-preview-scene={scene.master_id}>
                  <CreativeStill url={url} alt="" />
                  <p className="suite-kicker">Scene {String(index + 1).padStart(2, "0")}</p>
                  <p className="text-sm text-foreground">{sceneShortTitle(scene.title) ?? scene.title ?? "Untitled scene"}</p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <ol className="suite-preview-2d">
          {scenes.map((scene, index) => {
            const still = sceneStillUrl(scene);
            const url = still
              ? providerThumbnailUrl(still.provider, still.storage_ref, { timeSec: still.timeSec, width: 640 })
              : null;
            return (
              <li key={scene.master_id} data-preview-scene={scene.master_id}>
                <CreativeStill url={url} alt="" />
                <p className="suite-kicker">Scene {String(index + 1).padStart(2, "0")}</p>
                <p className="text-sm text-foreground">{sceneShortTitle(scene.title) ?? scene.title ?? "Untitled scene"}</p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={experienceHref} className={cn(buttonVariants({ size: "sm" }))}>
          Enter Experience
        </Link>
        <Link href={universeHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Open Universe
        </Link>
      </div>
    </div>
  );
}

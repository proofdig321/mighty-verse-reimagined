"use client";

import { useId, type PointerEvent } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { cn } from "@/lib/utils";

export function HolographicStage({
  title,
  layers,
  compact = false,
}: {
  title: string;
  layers: HolographicLayer[];
  compact?: boolean;
}) {
  const stageId = useId();

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
    event.currentTarget.style.setProperty("--hx", `${x}deg`);
    event.currentTarget.style.setProperty("--hy", `${y}deg`);
  }

  function onLeave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--hx", "0deg");
    event.currentTarget.style.setProperty("--hy", "0deg");
  }

  return (
    <div
      className={cn("holographic-stage", compact && "holographic-stage-compact")}
      aria-labelledby={stageId}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <p id={stageId} className="sr-only">
        2.5D holographic stage for {title}
      </p>
      <div className="holographic-space" aria-hidden={false}>
        {layers.map((layer) => (
          <article
            key={layer.layer_id}
            className={`holographic-layer holographic-layer-${layer.kind}`}
            data-holographic-kind={layer.kind}
            data-master-id={layer.master_id}
            style={{
              transform: `translate(-50%, -50%) translate3d(${layer.offset_x}px, ${layer.offset_y}px, ${layer.depth}px)`,
            }}
          >
            {layer.still_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={layer.still_url} alt="" />
            ) : (
              <div className="holographic-placeholder" />
            )}
            <p className="holographic-kicker">{layer.kind}</p>
            <p className="holographic-title">{layer.title ?? "Untitled"}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

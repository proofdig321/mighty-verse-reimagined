"use client";

import { holographicPanFromPointerX } from "./holographic-warp";

export type HolographicAudioGraph = {
  setPanFromPointerX: (pointerX: number) => void;
  resume: () => Promise<void>;
};

const graphs = new WeakMap<HTMLMediaElement, HolographicAudioGraph>();

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/**
 * Route the Mux <video> through a StereoPannerNode.
 * createMediaElementSource may be called only once per element.
 * Must run inside a user gesture (Play) so the AudioContext can start.
 */
export function attachHolographicAudio(video: HTMLVideoElement): HolographicAudioGraph | null {
  const existing = graphs.get(video);
  if (existing) return existing;
  if (typeof window === "undefined") return null;

  try {
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = new AudioContextClass();
    const source = ctx.createMediaElementSource(video);
    const panner = ctx.createStereoPanner();
    source.connect(panner);
    panner.connect(ctx.destination);

    let pan = 0;
    const graph: HolographicAudioGraph = {
      setPanFromPointerX(pointerX: number) {
        if (ctx.state !== "running") return;
        const target = holographicPanFromPointerX(pointerX);
        pan = pan + (target - pan) * 0.1;
        panner.pan.value = pan;
      },
      resume: () => ctx.resume(),
    };
    graphs.set(video, graph);
    return graph;
  } catch {
    return null;
  }
}

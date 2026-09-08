"use client";

import { useCallback, useRef, type ReactNode } from "react";

/**
 * Studio relationship focus: hovering or focusing a Scene or Creative Moment
 * makes the canonical counterpart visually apparent. Not Experience shuffle,
 * not drag-to-write, not a graph editor.
 */
export function CompositionSurface({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((scenes: string[], moments: string[]) => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-scene-id]").forEach((el) => {
      const id = el.dataset.sceneId;
      el.toggleAttribute("data-related", Boolean(id && scenes.includes(id)));
    });
    root.querySelectorAll<HTMLElement>("[data-moment-id]").forEach((el) => {
      const id = el.dataset.momentId;
      el.toggleAttribute("data-related", Boolean(id && moments.includes(id)));
    });
  }, []);

  const fromTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return { scenes: [] as string[], moments: [] as string[] };
    const scene = target.closest<HTMLElement>("[data-scene-id]");
    if (scene?.dataset.sceneId) {
      return {
        scenes: [scene.dataset.sceneId],
        moments: (scene.dataset.relatedMoments ?? "").split(/\s+/).filter(Boolean),
      };
    }
    const moment = target.closest<HTMLElement>("[data-moment-id]");
    if (moment?.dataset.momentId) {
      return {
        moments: [moment.dataset.momentId],
        scenes: (moment.dataset.relatedScenes ?? "").split(/\s+/).filter(Boolean),
      };
    }
    return { scenes: [] as string[], moments: [] as string[] };
  }, []);

  return (
    <div
      ref={rootRef}
      className="suite-composition"
      onMouseOver={(event) => {
        const related = fromTarget(event.target);
        apply(related.scenes, related.moments);
      }}
      onMouseLeave={() => apply([], [])}
      onFocusCapture={(event) => {
        const related = fromTarget(event.target);
        apply(related.scenes, related.moments);
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          const related = fromTarget(next);
          apply(related.scenes, related.moments);
          return;
        }
        apply([], []);
      }}
    >
      {children}
    </div>
  );
}

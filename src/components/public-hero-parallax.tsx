"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { HOLOGRAPHIC_PARALLAX_STRENGTH } from "@/lib/experience/holographic-warp";

function bindHeroParallax(surface: HTMLDivElement) {
  function apply(x: number, y: number, scroll: number) {
    surface.style.setProperty("--hero-px", x.toFixed(3));
    surface.style.setProperty("--hero-py", y.toFixed(3));
    surface.style.setProperty("--hero-scroll", scroll.toFixed(3));
    surface.style.setProperty("--hero-parallax", String(HOLOGRAPHIC_PARALLAX_STRENGTH));
  }

  function onPointer(event: PointerEvent) {
    const box = surface.getBoundingClientRect();
    const x = (event.clientX - box.left) / Math.max(1, box.width) - 0.5;
    const y = (event.clientY - box.top) / Math.max(1, box.height) - 0.5;
    const scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, box.height)));
    apply(x, y, scroll);
  }

  function onScroll() {
    const box = surface.getBoundingClientRect();
    const scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, box.height)));
    apply(Number(surface.style.getPropertyValue("--hero-px") || 0), Number(surface.style.getPropertyValue("--hero-py") || 0), scroll);
  }

  function onLeave() {
    apply(0, 0, Math.min(1, Math.max(0, window.scrollY / Math.max(1, surface.getBoundingClientRect().height))));
  }

  apply(0, 0, 0);
  surface.addEventListener("pointermove", onPointer);
  surface.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    surface.removeEventListener("pointermove", onPointer);
    surface.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onScroll);
  };
}

export function PublicHeroParallax({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const surface = rootRef.current;
    if (!surface) return;
    return bindHeroParallax(surface);
  }, [enabled]);

  const style = {
    "--hero-px": "0",
    "--hero-py": "0",
    "--hero-scroll": "0",
    "--hero-parallax": String(HOLOGRAPHIC_PARALLAX_STRENGTH),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="public-hero-parallax"
      data-public-hero-parallax={enabled ? "true" : "false"}
      style={style}
    >
      {enabled ? (
        <>
          <div className="public-hero-layer public-hero-layer-back" aria-hidden="true" />
          <div className="public-hero-layer public-hero-layer-mid" aria-hidden="true" />
        </>
      ) : null}
      <div className="public-hero-content">{children}</div>
    </div>
  );
}

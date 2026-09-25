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

  function getScroll() {
    const box = surface.getBoundingClientRect();
    return Math.min(1, Math.max(0, window.scrollY / Math.max(1, box.height)));
  }

  function onPointer(event: PointerEvent) {
    const box = surface.getBoundingClientRect();
    const x = (event.clientX - box.left) / Math.max(1, box.width) - 0.5;
    const y = (event.clientY - box.top) / Math.max(1, box.height) - 0.5;
    apply(x, y, getScroll());
  }

  function onTouch(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    const box = surface.getBoundingClientRect();
    const x = (touch.clientX - box.left) / Math.max(1, box.width) - 0.5;
    const y = (touch.clientY - box.top) / Math.max(1, box.height) - 0.5;
    apply(x, y, getScroll());
  }

  function onScroll() {
    const px = Number(surface.style.getPropertyValue("--hero-px") || 0);
    const py = Number(surface.style.getPropertyValue("--hero-py") || 0);
    apply(px, py, getScroll());
  }

  function onLeave() {
    apply(0, 0, getScroll());
  }

  // Gyroscope for mobile — DeviceOrientationEvent
  let gyroCleanup: (() => void) | null = null;
  function bindGyro() {
    function onOrientation(event: DeviceOrientationEvent) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // gamma = left/right tilt (-90 to 90), beta = front/back tilt (-180 to 180)
      const x = Math.max(-0.5, Math.min(0.5, (event.gamma ?? 0) / 45));
      const y = Math.max(-0.5, Math.min(0.5, ((event.beta ?? 0) - 45) / 60));
      apply(x, y, getScroll());
    }
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    gyroCleanup = () => window.removeEventListener("deviceorientation", onOrientation);
  }

  // Request gyro permission on iOS 13+
  if (typeof DeviceOrientationEvent !== "undefined") {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === "function") {
      // iOS — bind on first touch to avoid permission prompt on load
      const onFirstTouch = () => {
        DOE.requestPermission().then((state: string) => {
          if (state === "granted") bindGyro();
        }).catch(() => null);
        surface.removeEventListener("touchstart", onFirstTouch);
      };
      surface.addEventListener("touchstart", onFirstTouch, { passive: true });
    } else {
      bindGyro();
    }
  }

  apply(0, 0, 0);
  surface.addEventListener("pointermove", onPointer);
  surface.addEventListener("pointerleave", onLeave);
  surface.addEventListener("touchmove", onTouch, { passive: true });
  surface.addEventListener("touchend", onLeave, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    surface.removeEventListener("pointermove", onPointer);
    surface.removeEventListener("pointerleave", onLeave);
    surface.removeEventListener("touchmove", onTouch);
    surface.removeEventListener("touchend", onLeave);
    window.removeEventListener("scroll", onScroll);
    gyroCleanup?.();
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

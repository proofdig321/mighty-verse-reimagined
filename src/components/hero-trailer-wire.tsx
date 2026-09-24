"use client";

import { useEffect } from "react";

/**
 * Wires any [data-hero-trailer-proxy] button to click the
 * [data-hero-trailer-trigger] button rendered by PublicHeroVideo.
 * Both live in the same hero section.
 */
export function HeroTrailerWire() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const proxy = (event.target as HTMLElement).closest("[data-hero-trailer-proxy]");
      if (!proxy) return;
      const trigger = document.querySelector<HTMLButtonElement>("[data-hero-trailer-trigger]");
      trigger?.click();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through a list of labels with a fade transition.
 * Used in the hero headline to cycle universe titles.
 */
export function KineticCycler({
  labels,
  intervalMs = 2800,
}: {
  labels: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (labels.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % labels.length);
        setVisible(true);
      }, 350);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [labels, intervalMs]);

  return (
    <span
      className="kinetic-cycler"
      data-visible={visible ? "true" : "false"}
      aria-live="polite"
      aria-atomic="true"
    >
      {labels[index]}
    </span>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps children and adds a `data-revealed` attribute when the element
 * enters the viewport. CSS handles the actual animation via
 * `.scroll-reveal` and `.scroll-reveal[data-revealed="true"]`.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.setAttribute("data-revealed", "true"), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`scroll-reveal${className ? ` ${className}` : ""}`} data-revealed="false">
      {children}
    </div>
  );
}

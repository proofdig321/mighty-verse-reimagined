import type { ReactNode } from "react";

export function StudioSection({
  id,
  label,
  aside,
  children,
}: {
  id: string;
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="suite-section" aria-labelledby={id}>
      <div className="suite-section-head studio-section-head">
        <h2 id={id} className="suite-section-title">
          {label}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export function StudioOverflowMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="studio-overflow">
      <summary className="studio-overflow-trigger" aria-label={label}>
        <MoreHorizontal />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="studio-overflow-panel" role="menu" aria-label={label}>
        {children}
      </div>
    </details>
  );
}

export function StudioOverflowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} role="menuitem" className="studio-overflow-item">
      {children}
    </a>
  );
}

export function StudioOverflowItem({
  children,
  onSelect,
  disabled,
  destructive,
}: {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={destructive ? "studio-overflow-item is-destructive" : "studio-overflow-item"}
      disabled={disabled}
      onClick={(event) => {
        const root = event.currentTarget.closest("details");
        if (root) root.open = false;
        onSelect?.();
      }}
    >
      {children}
    </button>
  );
}

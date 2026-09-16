"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StudioRail({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="studio-rail-slot">
      <div className="studio-rail-mobile">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls="studio-nav-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu />
          Studio
        </Button>
      </div>
      {open ? (
        <button
          type="button"
          className="studio-nav-backdrop"
          aria-label="Close Studio navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside id="studio-nav-drawer" className={cn("studio-workspace-rail", open && "is-open")}>
        <div className="studio-rail-drawer-head">
          <p className="text-xs font-semibold">Studio</p>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Close Studio navigation" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        <div onClick={() => setOpen(false)}>{children}</div>
      </aside>
    </div>
  );
}

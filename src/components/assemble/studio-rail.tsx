"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function StudioRail({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="studio-rail-slot">
      {/* Mobile trigger — only visible below lg */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={14} />
          Studio
        </Button>
      </div>

      {/* Desktop rail — always visible at lg+ via CSS */}
      <aside className="studio-workspace-rail">
        {children}
      </aside>

      {/* Mobile Sheet — replaces bespoke backdrop + fixed aside */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(18rem,88vw)] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-sm">Studio</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3" onClick={() => setOpen(false)}>
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

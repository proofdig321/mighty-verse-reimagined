"use client";

import { RESET_SCOPES, resetScopeCopy, type ResetScope } from "@/lib/storyboard/mutations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StoryboardResetDialog({
  open,
  panelSelected,
  onClose,
  onConfirm,
}: {
  open: boolean;
  panelSelected: boolean;
  onClose: () => void;
  onConfirm: (scope: ResetScope) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset workspace</DialogTitle>
          <DialogDescription>
            Reset never silently destroys the Storyboard. Choose a scope. Canonical Scenes are not affected.
          </DialogDescription>
        </DialogHeader>
        <form
          id="storyboard-reset-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const scope = String(data.get("scope") || "unsaved") as ResetScope;
            onConfirm(scope);
          }}
        >
          <fieldset className="grid gap-3">
            {RESET_SCOPES.filter((scope) => panelSelected || (scope !== "panel" && scope !== "panel-artifacts")).map((scope) => {
              const copy = resetScopeCopy(scope);
              return (
                <label key={scope} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/30 transition-colors">
                  <input type="radio" name="scope" value={scope} defaultChecked={scope === "unsaved"} className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">{copy.title}</span>
                    <span className="block text-xs text-muted-foreground">{copy.body}</span>
                    {copy.destructive ? <span className="mt-1 block text-[11px] text-destructive">This is a destructive choice.</span> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="storyboard-reset-form">Reset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

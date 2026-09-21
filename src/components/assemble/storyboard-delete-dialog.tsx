"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StoryboardDeleteDialog({
  open,
  title,
  attached,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  attached: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workspace</DialogTitle>
          <DialogDescription>
            This permanently deletes <span className="text-foreground font-medium">{title || "this Storyboard workspace"}</span>
            {attached
              ? ", including its panels, references, and generation jobs. The associated canonical Universe is not deleted or changed."
              : ", including its panels, references, and generation jobs. Canonical Universes, Murals, and Scenes are not affected."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-[11px] text-destructive">This cannot be undone. Storyboard remains non-canonical until authorised — deleting it does not rewrite canon.</p>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

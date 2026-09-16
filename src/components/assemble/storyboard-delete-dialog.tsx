"use client";

import { Button } from "@/components/ui/button";

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
  if (!open) return null;
  return (
    <div className="storyboard-dialog-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-labelledby="storyboard-delete-title"
        aria-describedby="storyboard-delete-copy"
        className="storyboard-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="storyboard-delete-title" className="text-lg font-semibold">
          Delete workspace
        </h2>
        <p id="storyboard-delete-copy" className="mt-1 text-sm text-muted-foreground">
          This permanently deletes <span className="text-foreground">{title || "this Storyboard workspace"}</span>
          {attached
            ? ", including its panels, references, and generation jobs. The associated canonical Universe is not deleted or changed."
            : ", including its panels, references, and generation jobs. Canonical Universes, Murals, and Scenes are not affected."}
        </p>
        <p className="mt-3 text-[11px] text-destructive">This cannot be undone. Storyboard remains non-canonical until authorised — deleting it does not rewrite canon.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete workspace"}
          </Button>
        </div>
      </div>
    </div>
  );
}
